
import { GoogleGenAI, Type } from "@google/genai";
import type { LLMSettings, WorkflowState, ProviderSettings, RunLogEntry, WorkflowStatus } from "../types";
import { OLLAMA_CONFIG } from "./ollamaService";

/**
 * Creates a summarized and truncated version of the workflow state to be used in the LLM prompt,
 * preventing the context from growing too large.
 * @param {WorkflowState} state - The full current state of the workflow.
 * @returns {object} A sanitized state object suitable for including in the prompt.
 */
const prepareStateForPrompt = (state: WorkflowState): object => {
    const stateForPrompt = JSON.parse(JSON.stringify(state)); // Deep copy

    // Truncate runLog to the most recent 300 entries to avoid payload bloat
    if (stateForPrompt.runLog.length > 300) {
        stateForPrompt.runLog = stateForPrompt.runLog.slice(-300);
    }

    // These are output fields and not needed for the model's next turn.
    delete stateForPrompt.finalResultMarkdown;
    delete stateForPrompt.finalResultSummary;
    delete stateForPrompt.resultType;


    return stateForPrompt;
};

/**
 * Generates the system prompt for the LLM based on the current workflow state.
 * @param {WorkflowState} currentState - The current state of the workflow.
 * @param {string} [ragContent] - Optional content from a knowledge document for RAG.
 * @returns {string} The formatted system prompt.
 */
const getSystemPrompt = (currentState: WorkflowState, ragContent?: string) => {
    const contextReminder =
        currentState.currentIteration > 0 &&
        currentState.currentIteration % 5 === 0 &&
        currentState.state.initialPlan &&
        currentState.state.initialPlan.length > 0
        ? `
**CONTEXT REMINDER:** To focus on the long-term objective, use the original goal and the initial plan. Review before proceeding.

- **Original Goal:** ${currentState.goal}
- **Initial Plan:**
${currentState.state.initialPlan.map((step, i) => `  ${i + 1}. ${step}`).join('\n')}
---
` : '';

    const ragInstruction = `
**Accessing Previous Artifacts:** To read content from previous artifacts (e.g., requirements, earlier code), create an artifact with key \`rag_query\` and value as your search query (e.g., {"key": "rag_query", "value": "requirements specification"}). The system will search all artifacts and provide results in \`rag_results\` in the next iteration.
**Internet Search:** To search the internet for additional information, create an artifact with key \`internet_query\` and value as your search query (e.g., {"key": "internet_query", "value": "latest React best practices"}). The system will search the web and provide results in \`internet_results\` in the next iteration.
${ragContent ? '**User Knowledge Document:** A document has been uploaded. You can also search it using the same rag_query mechanism.' : ''}
`;

    const stateForPrompt = prepareStateForPrompt(currentState);

    return `${contextReminder}
You are an intelligent automation platform executing a complex, multi-step workflow.
Your goal is to achieve the user's objective by breaking it down into steps and iterating until completion.
You operate in a loop of three agents: Planner, Worker, and QA, with tools: RAG, internet search, and artifact writing. The execution order is Planner -> Worker -> QA -> Worker (next step) ... and the final Worker step ends the workflow with no QA afterward.
${ragInstruction}
**Context Management Rules:**
Your context window is limited. To ensure the workflow runs smoothly, you MUST adhere to the following rules for managing artifact size:
- **Code Artifacts:** When generating code, limit snippets to a maximum of 300 lines per iteration. If a file needs to be larger, you MUST split it across iterations and let QA approve appending more in follow-on iterations. For larger structures, instruct the Planner to add new steps and use imports/includes to connect them.
- **Text Artifacts:** If you are generating a large text document (e.g., a report, research notes), you MUST summarize it if the full text is not essential for the next immediate step. Store the full text in one artifact and create a separate artifact with a summary (e.g., 'report.md' and 'report_summary.md'). This helps keep the context for subsequent steps clean and focused.
- **Focus:** For each turn, focus on the user's main goal, the current step in the plan, feedback from other agents (in 'notes'), and the most recent log entries.
- **Verbosity:** Planner responses should be concise. Worker and QA responses should be verbose.

**ABSOLUTE PROHIBITIONS - VIOLATION = IMMEDIATE FAILURE:**
- **NEVER EXECUTE STEPS BACKWARDS**: The workflow can ONLY move FORWARD through steps. You CANNOT return to a previous step number. Once a step is completed, it stays completed. The current step number must ALWAYS increase or stay the same.
- **NEVER COMMUNICATE WITH EXTERNAL PARTIES**: You MUST NOT plan to contact, email, send quotes, or otherwise communicate with other parties, companies, or individuals outside of this system.

**Workflow Execution Flow:**

1.  **Planner:** Your first task is always to act as the Planner. Analyze the goal and the current state.
        **Step 1 - CRITICAL:** Using the user's goal, clarify, fill in unknowns with educated assumptions, and expand into a bullet list of requirements.
    -   **Step 2 - CRITICAL:** If the 'steps' array is empty, this is the INITIAL PLANNING PHASE. You MUST create ALL steps RIGHT NOW in this single iteration. DO NOT create just one step. 
  
       **MANDATORY PLAN STRUCTURE (You MUST create ALL these steps NOW):**
        - Step 1: "Clarify requirements, make assumptions, and write clear bulleted requirements specification"
        - Step 2: "Refine goal and generate all steps needed to achieve the goal"
        - Step 3 through step N-2: "[Implement requirement: crisp description of first bullet sub requirement from step 1]" continue with steps until all bullet requirements have their own step ... and so on ...
        - Step N-1: "Generate final result artifact (result.html/result.csv/result.md) from completed work"
        - Step N: "Summarize the final product from context and explain the result"
        
        **CRITICAL REQUIREMENTS:**
        1. Create a MINIMUM of 5 steps and MAXIMUM of 20 steps.
        2. Populate BOTH 'steps' and 'initialPlan' arrays with the EXACT SAME complete list of ALL steps.
        3. Steps 3 through N-1 MUST include a DETAILED description of the specific requirement being addressed (e.g., "Implement requirement: Create user authentication system", "Implement requirement: Build data visualization dashboard").
        4. The FINAL step (Step N) MUST summarize the answer in human readable text and generate the final result artifact.
        5. Set progress to "Planning complete. Ready to execute step 1."
        6. Log "Planner: Created comprehensive plan with X steps".
        7. After creating the plan, STOP planning and let the Worker agent take over.
        8. If the goal involves code, an application, an app, a program, a calculation, software, a script, or otherwise needs software code, you MUST use TypeScript/JavaScript for logic and HTML for UI, and target a single entry file named "index.html" for the UI output.
        
        **WRONG (DO NOT DO THIS):** Creating only Step 1 and planning to add more later
        **CORRECT (DO THIS):** Creating all 5-20 steps in the 'steps' array right now, then stopping
        
    -   **IMPORTANT:** The 'initialPlan' field must NEVER be modified after creation.
    -   **Subsequent Runs:** Find the next incomplete step. Update 'progress' to "Working on step X..." where X is the 1-based index. Log your action.
    -   **Crucially, the 'initialPlan' field must NEVER be modified after it is first created.** It serves as a permanent record of the original strategy.
2.  **Worker:** After the Planner, you act as the Worker. Execute the current step using the goal, requirements (if available), and current plan step description as context.
    -   **MANDATORY: Every Step Creates an Artifact.** EVERY step execution MUST produce at least one artifact. Name artifacts clearly: \`step_X_[description].[ext]\`.
    -   **Step 1 - Requirements:** Create artifact named \`Requirements.md\` with: bulleted list of requirements, assumptions, clarifications, success criteria. This will be shown under the Requirements heading.
    -   **Steps 2 through N-2 - Implementation:** Each step creates artifacts for accomplishing a requirement (e.g., \`step_3_database_schema.sql\`, \`step_4_api_endpoints.js\`, \`step_5_ui_component.tsx\`).
    -   **Use tools as needed:** RAG on previously generated artifacts, research the internet, write artifacts.
    -   **Final Assembly (Step N-1):** You may loop as needed to gather content from all prior steps and concatenate each loop result onto the final result artifact.
    -   **Final Step - Result:** Create the final deliverable as \`result.html\` (for web apps), \`result.csv\` (for data), or \`result.md\` (for reports). This will be displayed in the UI as the main result. No QA review is performed after the final Worker step.
    -   **Final Step Completion:** On the FINAL step you MUST complete the work and create the final result artifact. Iterate only once per step.
    -   **Reading Previous Work:** To access previous artifacts, create a \`rag_query\` artifact with your search query (e.g., {"key": "rag_query", "value": "requirements"}). The system will provide results in \`rag_results\` artifact in the next iteration.
    -   **Internet Access:** You do have internet access. You MUST attempt to search the web, fetch URLs, or reference external resources when you need additional information. The system will provide results in \`internet_results\` artifact in the next iteration.
    -   **Code Generation:** Write in TypeScript/JavaScript with proper extensions. Include inline CSS in HTML files.
    -   Update 'progress' field and log "Worker: Completed Agent [agent name]. Completed step X, created [artifact_name]. error[error message]" (omit error section if none).
3.  **QA:** After each Worker step (except the final step), you act as the QA agent. Review work against the original goal and clarified goal.
    -   **Final Step:** No QA review after the final Worker step; the Worker completes and closes the workflow.
    -   **Generate RequiredFixes:** Generate a concise list of improvements formatted for the Worker's next iteration when needed.
    -   **Step Failure Handling:** If a step fails to produce satisfactory results after 2 attempts, create a note artifact and explain. Set status to "running".
    -   **If Step Complete:** Save Worker artifacts and move to the next step.
    -   **If goal is fully achieved on the last step, perform final steps:**
        1. **Categorize Result:** Determine if the primary output is 'code', 'text', or 'table'. Set the \`resultType\` field accordingly (mandatory for completion).
        2. **Create README:** Create a comprehensive \`README.md\` artifact following the **80/20 rule**:
           - **80% CONTENT**: The bulk of README.md must directly answer the user's goal. Use BOTH your LLM knowledge AND any internet_results/rag_results to provide substantive, informative content that addresses what the user asked for. Include facts, data, explanations, analysis, code, or whatever deliverables satisfy the goal.
           - **20% PROCESS**: Only briefly describe how the goal was achieved (methodology, tools used, steps taken). This should be a short section at the end, not the focus.
           - Structure: Title + executive summary → Main content sections answering the goal → Brief methodology/process section at end.
           - For research/analysis goals: Include the actual findings, data, insights, and conclusions prominently.
           - For code goals: Include the actual code with explanations of what it does.
           - For Q&A goals: Include the actual answer with supporting evidence.
        3. **Update State:** Add the new \`README.md\` artifact to the \`artifacts\` array.
        4. **Set Final Outputs:** 
           - Set \`finalResultMarkdown\` to exactly the README content (the full 80/20 report).
           - Set \`finalResultSummary\` to a concise summary that directly answers the goal in 2-4 paragraphs. This should be the KEY FINDINGS, ANSWER, or DELIVERABLE - not a description of the process. If the goal was a question, include the answer. If it was research, include the key insights.
        5. **MANDATORY: Set Status:** Set \`status\` to "completed".

**Current State:**
You are on iteration ${currentState.currentIteration + 1} of ${currentState.maxIterations}.
The current state of the workflow is provided below in JSON format. 

\`\`\`json
${JSON.stringify(stateForPrompt, null, 2)}
\`\`\`

**Your Task:**
Perform the next logical agent action (Planner -> Worker -> QA).
You MUST respond with the complete, updated workflow state in the specified JSON format.
Do not just return the changed fields; return the entire state object.
Ensure your response is valid JSON that conforms to the provided schema.
`;
}
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        goal: { type: Type.STRING },
        maxIterations: { type: Type.INTEGER },
        currentIteration: { type: Type.INTEGER },
        status: { type: Type.STRING },
        runLog: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    iteration: { type: Type.INTEGER },
                    agent: { type: Type.STRING },
                    summary: { type: Type.STRING }
                },
                required: ['iteration', 'agent', 'summary']
            }
        },
        state: {
            type: Type.OBJECT,
            properties: {
                goal: { type: Type.STRING },
                steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                initialPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
                artifacts: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            key: { type: Type.STRING, description: "The name or key for the artifact." },
                            value: { type: Type.STRING, description: "The value of the artifact. If the value is a complex object or array, it must be a JSON string." }
                        },
                        required: ['key', 'value']
                    }
                },
                notes: { type: Type.STRING },
                progress: { type: Type.STRING }
            },
            required: ['goal', 'steps', 'artifacts', 'notes', 'progress']
        },
        finalResultMarkdown: { type: Type.STRING },
        finalResultSummary: { type: Type.STRING },
        resultType: { type: Type.STRING, description: "The type of result, either 'code', 'text', or 'table'. Should be set by the QA agent upon completion." }
    },
    required: ['goal', 'maxIterations', 'currentIteration', 'status', 'runLog', 'state', 'finalResultMarkdown', 'finalResultSummary']
};

const _appendNote = (existing: string, addition: string) => {
    if (!existing) return addition;
    return `${existing} | ${addition}`;
};

const _enforceRunLogFormat = (entries: RunLogEntry[]): RunLogEntry[] => {
    return entries.map(entry => {
        if (!entry || typeof entry.summary !== 'string' || typeof entry.agent !== 'string') return entry;
        const trimmedSummary = entry.summary.trim();
        const prefix = `${entry.agent}:`;
        if (trimmedSummary.toLowerCase().startsWith(prefix.toLowerCase())) {
            return { ...entry, summary: trimmedSummary };
        }
        return { ...entry, summary: `${prefix} ${trimmedSummary}` };
    });
};

const _autoAssembleReadme = (goal: string, artifacts: { key: string, value: string }[]): string => {
    // Process/internal artifacts to EXCLUDE from final result (20% process, not content)
    const processArtifactPatterns = [
        /^rag_/i, /^internet_/i, /notes/i, /query$/i,
        /^plan\.md$/i, /^requirements\.md$/i,
        /^step_\d+_(plan|refined|goal)/i,  // Process planning artifacts
        /^step_\d+_requirement/i,           // Requirements artifacts (process)
        /summary/i
    ];
    
    // Content artifacts to PRIORITIZE for final result (80% content)
    const contentArtifactPatterns = [
        /^result\./i, /^final/i, /^readme\.md$/i,
        /colors/i, /output/i, /answer/i, /findings/i
    ];
    
    // Filter to only content artifacts, excluding process artifacts
    const contentArtifacts = artifacts.filter(a => {
        const keyLower = (a.key || '').toLowerCase();
        // Exclude process artifacts
        if (processArtifactPatterns.some(pattern => pattern.test(keyLower))) {
            return false;
        }
        return true;
    });
    
    // Prioritize content artifacts (those that match content patterns come first)
    const prioritized = [...contentArtifacts].sort((a, b) => {
        const aIsContent = contentArtifactPatterns.some(p => p.test(a.key));
        const bIsContent = contentArtifactPatterns.some(p => p.test(b.key));
        if (aIsContent && !bIsContent) return -1;
        if (!aIsContent && bIsContent) return 1;
        return 0;
    });

    const sections = prioritized.map(a => {
        const header = a.key;
        // Ensure value is a string, not [object Object]
        let body = '';
        if (a.value === null || a.value === undefined) {
            body = '';
        } else if (typeof a.value === 'string') {
            body = a.value.trim();
        } else if (typeof a.value === 'object') {
            try {
                body = JSON.stringify(a.value, null, 2);
            } catch {
                body = String(a.value);
            }
        } else {
            body = String(a.value).trim();
        }
        if (!body) return '';
        return `## ${header}\n${body}\n`;
    }).filter(Boolean);

    return `# ${goal}\n\n${sections.join('\n')}`;
};

const _enforceFinalStepRules = (state: WorkflowState): WorkflowState => {
    const totalSteps = state.state.steps?.length || 0;
    const stepNum = _detectStepNumber(state);
    if (totalSteps === 0 || stepNum < totalSteps) {
        return state;
    }

    const runLog = [...(state.runLog || [])];
    if (runLog.length > 0) {
        const last = runLog[runLog.length - 1];
        if (last?.agent?.toLowerCase() === 'qa') {
            runLog[runLog.length - 1] = {
                ...last,
                agent: 'Worker',
                summary: `Worker (final step): ${last.summary}`
            };
            state.state.notes = _appendNote(state.state.notes, 'Final step: QA skipped; treated as Worker completion.');
        }
    }

    return {
        ...state,
        runLog: _enforceRunLogFormat(runLog),
        state: {
            ...state.state,
            notes: state.state.notes
        }
    };
};

const _validateArtifactsAndFinals = (previousState: WorkflowState, newState: WorkflowState): WorkflowState => {
    const totalSteps = newState.state.steps?.length || 0;
    const stepNum = _detectStepNumber(newState);
    const prevCount = previousState.state.artifacts?.length || 0;
    const newCount = newState.state.artifacts?.length || 0;
    let status = newState.status;
    let notes = newState.state.notes || '';
    let runLog = [...newState.runLog];

    const addQAWarning = (message: string) => {
        notes = _appendNote(notes, message);
        runLog.push({
            iteration: previousState.currentIteration + 1,
            agent: 'QA',
            summary: `QA: ${message}`
        });
        status = 'running';
    };

    if (stepNum > 0 && stepNum < totalSteps) {
        if (newCount <= prevCount) {
            addQAWarning(`Step ${stepNum}: No new artifacts created; each step must produce at least one artifact.`);
        }
    }

    if (totalSteps > 0 && stepNum === totalSteps - 1) {
        const artifacts = newState.state.artifacts || [];
        const hasREADME = artifacts.some(a => /readme\.md$/i.test(a.key));
        const hasAssembly = artifacts.some(a =>
            /result\.(html|md|csv)$/i.test(a.key) || /final/i.test(a.key) || /readme\.md$/i.test(a.key)
        );
        if (!hasAssembly || !hasREADME) {
            const readme = _autoAssembleReadme(newState.goal, artifacts);
            newState.state.artifacts.push({ key: 'README.md', value: readme });
            newState.runLog.push({
                iteration: previousState.currentIteration + 1,
                agent: 'Worker',
                summary: 'Worker: Auto-assembled README.md from prior artifacts (final assembly fallback).'
            });
            newState.state.notes = _appendNote(newState.state.notes, 'Auto-assembled README.md from prior artifacts for final assembly.');
            addQAWarning(
                `Step ${stepNum}: Final assembly missing. Perform RAG over all prior artifacts (ignore process notes), extract goal-relevant content, append human-readable paragraphs per step into README.md, and emit README.md/result.*.`
            );
        }
    }

    if (totalSteps > 0 && stepNum === totalSteps) {
        const hasSummary = Boolean(newState.finalResultSummary && newState.finalResultSummary.trim().length > 0);
        const hasMarkdown = Boolean(newState.finalResultMarkdown && newState.finalResultMarkdown.trim().length > 0);
        const artifacts = newState.state.artifacts || [];
        const hasSummaryArtifact = artifacts.some(a => /summary/i.test(a.key));
        if (!hasSummary || !hasMarkdown || !hasSummaryArtifact) {
            const readmeArtifact = artifacts.find(a => /readme\.md$/i.test(a.key));
            if (readmeArtifact && readmeArtifact.value) {
                const summaryText = readmeArtifact.value.slice(0, 1200);
                newState.finalResultMarkdown = newState.finalResultMarkdown || readmeArtifact.value;
                newState.finalResultSummary = newState.finalResultSummary || summaryText;
                newState.state.artifacts.push({
                    key: 'result_summary.md',
                    value: newState.finalResultSummary
                });
                newState.runLog.push({
                    iteration: previousState.currentIteration + 1,
                    agent: 'Worker',
                    summary: 'Worker: Auto-generated final summary from README.md.'
                });
                newState.state.notes = _appendNote(newState.state.notes, 'Auto-generated final summary from README.md.');
            }
            addQAWarning(
                `Step ${stepNum}: Final summary missing. Summarize README.md into finalResultSummary and finalResultMarkdown, and create a summary artifact (e.g., result_summary.md) for UI display.`
            );
        } else {
            // All final artifacts are present, mark as completed
            newState.status = 'completed';
        }
    }

    return {
        ...newState,
        status,
        runLog,
        state: {
            ...newState.state,
            notes
        }
    };
};

const _normalizeWorkflowState = (raw: any, fallbackGoal: string): WorkflowState => {
    const allowedStatuses: WorkflowStatus[] = ['running', 'completed', 'needs_clarification', 'error'];
    const safeStatus: WorkflowStatus = allowedStatuses.includes(raw?.status) ? raw.status : 'running';

    const safeResultType = raw?.resultType === 'code' || raw?.resultType === 'text' || raw?.resultType === 'table' ? raw.resultType : undefined;

    const safeState: WorkflowState = {
        goal: typeof raw?.goal === 'string' ? raw.goal : fallbackGoal,
        maxIterations: Number.isInteger(raw?.maxIterations) ? raw.maxIterations : 10,
        currentIteration: Number.isInteger(raw?.currentIteration) ? raw.currentIteration : 0,
        status: safeStatus,
        runLog: _enforceRunLogFormat(Array.isArray(raw?.runLog) ? raw.runLog.filter((e: any) =>
            e && Number.isInteger(e.iteration) && typeof e.agent === 'string' && typeof e.summary === 'string'
        ) : []),
        state: {
            goal: typeof raw?.state?.goal === 'string' ? raw.state.goal : fallbackGoal,
            steps: Array.isArray(raw?.state?.steps) ? raw.state.steps : [],
            initialPlan: Array.isArray(raw?.state?.initialPlan) ? raw.state.initialPlan : [],
            artifacts: Array.isArray(raw?.state?.artifacts) ? raw.state.artifacts : [],
            notes: typeof raw?.state?.notes === 'string' ? raw.state.notes : '',
            progress: typeof raw?.state?.progress === 'string' ? raw.state.progress : '',
        },
        finalResultMarkdown: typeof raw?.finalResultMarkdown === 'string' ? raw.finalResultMarkdown : '',
        finalResultSummary: typeof raw?.finalResultSummary === 'string' ? raw.finalResultSummary : '',
        resultType: safeResultType,
    };

    return safeState;
};

const _parseAndValidateWorkflow = (responseData: any, fallbackGoal: string): WorkflowState => {
    if (!responseData || typeof responseData.response !== 'string') {
        throw new Error('LLM response missing "response" field');
    }
    console.log('LLM response:', responseData.response);
    let jsonStr = responseData.response.trim();

    // Extract JSON from markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: WorkflowState;
    try {
        parsed = JSON.parse(jsonStr);
    } catch (err) {
        throw new Error(`LLM returned invalid JSON: ${err.message}`);
    }
    return _normalizeWorkflowState(parsed, fallbackGoal);
};

const _detectStepNumber = (state: WorkflowState): number => {
    const match = state.state.progress?.match(/step\s+(\d+)/i);
    if (match) return parseInt(match[1], 10);
    return 0;
};

const _runOllamaWorkflow = async (currentState: WorkflowState, settings: ProviderSettings, ragContent: string | undefined, fetchFn: typeof fetch, provider: string): Promise<WorkflowState> => {
    let baseURL = settings.baseURL || OLLAMA_CONFIG.host;
    let url = `${baseURL}/api/generate`;
    if (provider === 'gemini') {
        baseURL = 'http://localhost:3251/api/ai';
        url = `${baseURL}/generate`;
    }
    const prompt = getSystemPrompt(currentState, ragContent);
    const stepNum = _detectStepNumber(currentState);
    const totalSteps = currentState.state.steps?.length || 0;
    const isPlanning = totalSteps === 0;
    const isFirstStep = stepNum === 1;
    const isFinalStep = totalSteps > 0 && stepNum === totalSteps;
    const temperature = (isPlanning || isFirstStep || isFinalStep) ? 0.7 : 0.3;
    const body = {
        model: settings.model || process.env.MODEL || 'llama3.2',
        prompt: prompt,
        format: 'json',
        stream: false,
        options: {
            num_ctx: 15000,
            temperature
        }
    };

    // Internal API calls don't need authentication
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Note: No Authorization header needed for internal backend-to-backend calls

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const controller = new AbortController();
            // First attempt 500s; second retry 1000s
            const timeoutMs = attempt === 0 ? 500000 : 1000000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetchFn(url, {
                method: 'POST',
                body: JSON.stringify(body),
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI API error (${response.status}): ${errorText}`);
            }
            const responseData = await response.json();
            return _parseAndValidateWorkflow(responseData, currentState.goal);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            if (err.name === 'AbortError') {
                lastError = new Error(`Ollama request timed out after ${attempt === 0 ? '500s' : '1000s'}; generation took too long or server is busy.`);
            } else {
                lastError = err;
            }
            if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    throw lastError || new Error("Ollama request failed after 3 attempts");
};



/**
 * Performs a simple keyword-based search on the provided content.
 * @param {string} query - The search query.
 * @param {string} content - The content to search within.
 * @returns {string} A string containing the most relevant snippets or a message if no results are found.
 */
const _executeRAG = (query: string, content: string): string => {
    if (!query || !content) {
        return "No query or content provided for search.";
    }

    const chunks = content.split(/\n\s*\n/).filter(p => p.trim().length > 10);
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    if (queryWords.size === 0) {
        return "Query is too generic. Please provide more specific keywords.";
    }
    
    const scoredChunks = chunks.map(chunk => {
        const chunkWords = new Set(chunk.toLowerCase().split(/\s+/));
        let score = 0;
        for (const word of queryWords) {
            if (chunkWords.has(word)) {
                score++;
            }
        }
        return { chunk, score };
    }).filter(item => item.score > 0);

    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, 3).map(item => item.chunk);

    if (topChunks.length === 0) {
        return "No relevant information found in the document for your query.";
    }

    return `Here are the most relevant snippets from the document:\n\n---\n\n${topChunks.join('\n\n---\n\n')}`;
};

/**
 * Executes a single iteration of the workflow using the configured LLM provider.
 * It also handles the RAG (Retrieval-Augmented Generation) flow if requested by the agent.
 * @param {WorkflowState} currentState - The state of the workflow before the iteration.
 * @param {LLMSettings} settings - The configured LLM provider settings.
 * @param {string} [ragContent] - Optional knowledge content for the RAG system.
 * @param {typeof fetch} [fetchOverride] - Optional fetch implementation for testing.
 * @returns {Promise<WorkflowState>} The workflow state after the iteration.
 */
export const runWorkflowIteration = async (currentState: WorkflowState, settings: LLMSettings, ragContent?: string, fetchOverride?: typeof fetch): Promise<WorkflowState> => {
    const provider = settings.provider;
    const providerSettings = settings[provider];
    const fetchFn = fetchOverride || fetch;
    
    const attempts = 2; // first retry silent, second failure surfaces
    let newState: WorkflowState | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            switch (provider) {
                // case 'ollama': // Commented out Ollama usage but not deleted
                //     newState = await _runOllamaWorkflow(currentState, providerSettings, ragContent, fetchFn, provider);
                //     break;
                case 'gemini':
                    newState = await _runOllamaWorkflow(currentState, providerSettings, ragContent, fetchFn, provider);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
            break; // success
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt === 0) {
                // Silent retry after brief delay
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }
        }
    }

    if (!newState) {
        const failureMessage = `Workflow error: ${lastError?.message || 'Unknown error'}`;
        const failureLog: RunLogEntry = { iteration: currentState.currentIteration + 1, agent: 'QA', summary: failureMessage };
        const runLog = _enforceRunLogFormat([...currentState.runLog, failureLog]);
        return {
            ...currentState,
            status: 'error',
            runLog,
            state: {
                ...currentState.state,
                notes: _appendNote(currentState.state.notes, failureMessage),
            }
        };
    }

    const ragQueryArtifact = newState.state.artifacts.find(a => a.key === 'rag_query');
    const internetQueryArtifact = newState.state.artifacts.find(a => a.key === 'internet_query');
    const iterIndex = currentState.currentIteration + 1;

    if (ragQueryArtifact) {
        newState.state.artifacts = newState.state.artifacts.filter(a => a.key !== 'rag_query');
        const query = ragQueryArtifact.value;
        
        const allArtifactsContent = newState.state.artifacts
            .map(a => `[${a.key}]\n${a.value}\n\n`)
            .join('---\n\n');
        
        const combinedContent = ragContent ? `${allArtifactsContent}\n\n[USER DOCUMENT]\n${ragContent}` : allArtifactsContent;
        
        if (combinedContent.trim()) {
            const ragResults = _executeRAG(query, combinedContent);
            newState.state.artifacts.push({ key: 'rag_results', value: ragResults });
            newState.state.notes = _appendNote(newState.state.notes, `Search completed for "${query}". Results in 'rag_results'.`);
            newState.runLog = [...newState.runLog, { iteration: iterIndex, agent: 'Worker', summary: `RAG search for "${query}" added rag_results` }];
        } else {
            newState.state.notes = _appendNote(newState.state.notes, `No artifacts or documents available to search.`);
            newState.runLog = [...newState.runLog, { iteration: iterIndex, agent: 'Worker', summary: `RAG search for "${query}" skipped - no content` }];
        }
    }

    if (internetQueryArtifact) {
        newState.state.artifacts = newState.state.artifacts.filter(a => a.key !== 'internet_query');
        const query = internetQueryArtifact.value;
        
        try {
            // Use backend endpoint to avoid CORS issues
            // Backend searches both DuckDuckGo (8 results) and Wikipedia (8 results)
            // NOTE: No auth header for search - endpoint allows unauthenticated access
            const searchUrl = '/api/ai/test-search';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            console.log(`[Internet Search] Executing search for: "${query}"`);
            
            const response = await fetchFn(searchUrl, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query }),
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            
            // Check if response is OK before parsing
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            console.log(`[Internet Search] Response data:`, JSON.stringify(data).slice(0, 500));
            
            // Check for API error response
            if (data.error) {
                throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
            }
            
            // Format results from backend response (DuckDuckGo + Wikipedia)
            let resultsText = `# Internet Search Results for: "${query}"\n\n`;
            
            if (data.abstract?.text) {
                resultsText += `## Summary\n${data.abstract.text}\n\n`;
            }
            
            // Get all results (may not have source field in some cases)
            const allResults = data.results || [];
            const ddgResults = allResults.filter((r: any) => r.source === 'DuckDuckGo');
            const wikiResults = allResults.filter((r: any) => r.source === 'Wikipedia');
            const otherResults = allResults.filter((r: any) => !r.source || (r.source !== 'DuckDuckGo' && r.source !== 'Wikipedia'));
            
            if (ddgResults.length > 0) {
                resultsText += `## DuckDuckGo Results (${ddgResults.length} found)\n\n`;
                ddgResults.forEach((r: { text: string; url: string; source?: string }, idx: number) => {
                    resultsText += `${idx + 1}. ${r.text}\n   URL: ${r.url}\n\n`;
                });
            }
            
            if (wikiResults.length > 0) {
                resultsText += `## Wikipedia Results (${wikiResults.length} found)\n\n`;
                wikiResults.forEach((r: { text: string; url: string; source?: string }, idx: number) => {
                    resultsText += `${idx + 1}. ${r.text}\n   URL: ${r.url}\n\n`;
                });
            }
            
            // Handle results without source (fallback)
            if (otherResults.length > 0 && ddgResults.length === 0 && wikiResults.length === 0) {
                resultsText += `## Search Results (${otherResults.length} found)\n\n`;
                otherResults.forEach((r: { text: string; url: string }, idx: number) => {
                    resultsText += `${idx + 1}. ${r.text}\n   URL: ${r.url}\n\n`;
                });
            }
            
            const totalResults = allResults.length;
            
            // Only use "No results" if truly no results
            let finalResults: string;
            if (totalResults === 0 && !data.abstract?.text) {
                finalResults = `No results found for query: "${query}". Try broadening your search criteria or using different keywords.`;
            } else {
                finalResults = resultsText.trim();
            }
            
            console.log(`[Internet Search] Final results (${totalResults} items):`, finalResults.slice(0, 300));
            
            newState.state.artifacts.push({ key: 'internet_results', value: finalResults });
            newState.state.notes = _appendNote(newState.state.notes, `Internet search completed for "${query}". Found ${totalResults} results; QA validate relevance.`);
            newState.runLog = [...newState.runLog, { iteration: iterIndex, agent: 'Worker', summary: `Internet search for "${query}" returned ${totalResults} results` }];
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            console.error(`[Internet Search] Error:`, errorMsg);
            newState.state.artifacts.push({ key: 'internet_results', value: `Internet search failed: ${errorMsg}. Please try a different query or broaden your search criteria.` });
            newState.state.notes = _appendNote(newState.state.notes, `Internet search failed for "${query}": ${errorMsg}. QA: Consider recreating with broader search criteria.`);
            newState.runLog = [...newState.runLog, { iteration: iterIndex, agent: 'Worker', summary: `Internet search failed for "${query}": ${errorMsg}` }];
        }
    }

    newState = _validateArtifactsAndFinals(currentState, newState);
    newState.runLog = _enforceRunLogFormat(newState.runLog);

    // Enforce final-step rule: no QA after the last Worker step.
    return _enforceFinalStepRules(newState);
};

/**
 * Tests the connection to the currently configured LLM provider to ensure settings are valid.
 * @param {LLMSettings} settings - The LLM settings to test.
 * @param {typeof fetch} [fetchOverride] - Optional fetch implementation for testing.
 * @returns {Promise<boolean>} A promise that resolves to true if the connection is successful.
 * @throws {Error} Throws an error if the connection fails.
 */
export const testProviderConnection = async (settings: LLMSettings, fetchOverride?: typeof fetch): Promise<boolean> => {
    const provider = settings.provider;
    const providerSettings = settings[provider];
    const fetchFn = fetchOverride || fetch;

    try {
        switch (provider) {
            // case 'ollama': // Commented out Ollama usage but not deleted
            //     const baseURL = providerSettings.baseURL || OLLAMA_CONFIG.host;
            //     const ollamaUrl = `${baseURL}/api/tags`;
            //     const ollamaResp = await fetchFn(ollamaUrl);
            //     if (!ollamaResp.ok) throw new Error(`Ollama connection failed: ${ollamaResp.statusText}`);
            //     const ollamaData = await ollamaResp.json();
            //     return Array.isArray(ollamaData.models);
            default:
                return false;
        }
    } catch (e) {
        console.error(`Connection test failed for ${provider}:`, e);
        throw e;
    }
};
