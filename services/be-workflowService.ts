
import { GoogleGenAI, Type } from "@google/genai";
import type { LLMSettings, WorkflowState, ProviderSettings } from "../types";

/**
 * Creates a summarized and truncated version of the workflow state to be used in the LLM prompt,
 * preventing the context from growing too large.
 * @param {WorkflowState} state - The full current state of the workflow.
 * @returns {object} A sanitized state object suitable for including in the prompt.
 */
const prepareStateForPrompt = (state: WorkflowState): object => {
    const stateForPrompt = JSON.parse(JSON.stringify(state)); // Deep copy

    // Truncate runLog to maxIterations, keeping the most recent entries
    if (stateForPrompt.runLog.length > state.maxIterations) {
        stateForPrompt.runLog = stateForPrompt.runLog.slice(-state.maxIterations);
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
**CONTEXT REMINDER:** To maintain focus on the long-term objective, here is the original goal and the initial plan you created. Review it before proceeding.

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
You operate in a loop of three agents: Planner, Worker, and QA.
${ragInstruction}
**Context Management Rules:**
Your context window is limited. To ensure the workflow runs smoothly, you MUST adhere to the following rules for managing artifact size:
- **Code Artifacts:** When generating code, limit snippets to a maximum of 500 lines. If a file needs to be larger, you MUST instruct the Planner to add new steps to create multiple smaller files and use imports/includes to connect them.
- **Text Artifacts:** If you are generating a large text document (e.g., a report, research notes), you MUST summarize it if the full text is not essential for the next immediate step. Store the full text in one artifact and create a separate artifact with a summary (e.g., 'report.md' and 'report_summary.md'). This helps keep the context for subsequent steps clean and focused.
- **Focus:** For each turn, focus on the user's main goal, the current step in the plan, feedback from other agents (in 'notes'), and the most recent log entries.

**Workflow Execution Flow:**

1.  **Planner:** Your first task is always to act as the Planner. Analyze the goal and the current state.
        **Step 1 - CRITICAL:** Using the user's goal clarify, fill in unknowns with educated assumptions and then expand into a bullet list of requirements.
    -   **Step 2 - CRITICAL:** If the 'steps' array is empty, this is the INITIAL PLANNING PHASE. You MUST create ALL steps RIGHT NOW in this single iteration. DO NOT create just one step. DO NOT plan to add more steps later. Create the ENTIRE plan NOW. After creating the plan, you are DONE with planning - move to the next agent (Worker).
        
        **MANDATORY PLAN STRUCTURE (You MUST create ALL these steps NOW):**
        - Step 1: "Clarify requirements, make assumptions, and write clear bulleted requirements specification"
        - Step 2: "Refine goal and generate all steps needed to achieve the goal"
        - Step 3: "[Implement requirement: crisp description of first bullet sub requirement from step 1]"
        - Step 4: "[Implement requirement: crisp description of second bullet sub requirement from step 1]" then continue with steps until all bullet requirements have their own step ... and so on ...
        - Step N-1: "[Implement last requirement: crisp description of last bullet sub requirement from step 1]"
        - Step N: "Summarize final answer to the goal and generate final result artifact (result.html/result.csv/result.md)"
        
        **CRITICAL REQUIREMENTS:**
        1. Create a MINIMUM of 5 steps and MAXIMUM of 15 steps
        2. Populate BOTH 'steps' and 'initialPlan' arrays with the EXACT SAME complete list of ALL steps
        3. Steps 3 through N-1 MUST include a CRISP description of the specific requirement being addressed (e.g., "Implement requirement: Create user authentication system", "Implement requirement: Build data visualization dashboard")
        4. The FINAL step (Step N) MUST summarize the answer and generate the final result artifact
        5. Set progress to "Planning complete. Ready to execute step 1."
        6. Log "Planner: Created comprehensive plan with X steps"
        7. After creating the plan, STOP planning and let the Worker agent take over
        
        **WRONG (DO NOT DO THIS):** Creating only Step 1 and planning to add more later
        **CORRECT (DO THIS):** Creating all 5-15 steps in the 'steps' array right now, then stopping
        
    -   **IMPORTANT:** The 'initialPlan' field must NEVER be modified after creation.
    -   **Subsequent Runs:** Find the next incomplete step. Update 'progress' to "Working on step X..." where X is the 1-based index. Log your action.
    -   **Crucially, the 'initialPlan' field must NEVER be modified after it is first created.** It serves as a permanent record of the original strategy.
2.  **Worker:** After the Planner, you act as the Worker. Execute the current step using the original goal, clarified goal (if available), and current plan step as context.
    -   **MANDATORY: Every Step Creates an Artifact.** EVERY step execution MUST produce at least one artifact. Name artifacts clearly: \`step_X_[description].[ext]\`.
    -   **Step 1 - Requirements:** Create artifact named \`Requirements.md\` with: bulleted list of requirements, assumptions, clarifications, success criteria. This will be shown under the Requirements heading.
    -   **Step 2 - Plan:** Create artifact named \`Plan.md\` containing a numbered list of ALL steps with detailed descriptions for each step. Format:
        1. Step Name - Description of what will be accomplished
        2. Step Name - Description of what will be accomplished
        This will display in the sidebar and be downloadable.
    -   **Steps 3-X - Implementation:** Each step creates artifacts for accomplishing a requirement (e.g., \`step_3_database_schema.sql\`, \`step_4_api_endpoints.js\`, \`step_5_ui_component.tsx\`).
    -   **Final Step - Result:** Create the final deliverable as \`result.html\` (for web apps), \`result.csv\` (for data), or \`result.md\` (for reports). This will be displayed in the UI as the main result.
    -   **Final Step Completion:** On the FINAL step, if this is the fourth iteration of the final step, you MUST complete the work and create the final result artifact regardless of perfection. Do not continue iterating.
    -   **Reading Previous Work:** To access previous artifacts, create a \`rag_query\` artifact with your search query (e.g., {"key": "rag_query", "value": "requirements"}). The system will provide results in \`rag_results\` artifact in the next iteration.
    -   **Internet Access:** You do have internet access. You MUST attempt to search the web, fetch URLs, or reference external resources when you need additional information. The system will provide results in \`internet_results\` artifact in the next iteration.
    -   **Code Generation:** Write in TypeScript/JavaScript with proper extensions.
    -   **Web Design:** Include inline CSS in HTML files.
    -   Update 'progress' field and log "Worker: Completed step X, created [artifact_name]".
3.  **QA:** After the Worker, you act as the QA agent. Review work against the original goal and clarified goal.
    -   **MANDATORY: Final Step Iteration Limit:** If this is the FINAL step and after 4 attempted iterations, you MUST approve the work and mark as complete. Do not request further changes.
    -   **Step Failure Handling:** If a step fails to produce satisfactory results after 3 attempts, you MAY add new steps ONLY to try an alternate approach. Insert new steps after the failed step.
    -   **If Not Complete:** Provide specific feedback in 'notes'. Set status to "running". Do NOT add steps unless a step has failed 3 times.
    -   **If Complete:** If goal is fully achieved, perform final steps:
        1.  **Categorize Result:** First, determine if the primary output is 'code' (e.g., a software project, scripts) or 'text' (e.g., a report, analysis, story). Set the \`resultType\` field in the root of the state object to either "code" or "text". This field is mandatory for a completed status.
        2.  **Generate README:** Create a comprehensive \`README.md\` file as a new artifact. This file is the primary deliverable. Its content should be professionally formatted and inspired by high-quality open-source projects (like \`cline/cline\` on GitHub). It MUST include:
            -   A clear title and a concise one-sentence summary of the project.
            -   An "Overview" section explaining the project's purpose and key features.
            -   A "Getting Started" or "Usage" section with instructions. If \`resultType\` is "code", this means installation (\`npm install\`) and execution (\`npm run dev\`) commands. If \`resultType\` is "text", this means explaining the findings or how to read the report.
            -   A "Technical Details" or "Methodology" section if applicable, detailing architecture or dependencies.
        3.  **Update State:** Add the new \`README.md\` artifact to the \`artifacts\` array.
        4.  **Set Final Outputs:** Set the \`finalResultMarkdown\` field to the **exact same content** as the \`README.md\` artifact. Generate a brief, user-friendly summary of the project's outcome and put it in the \`finalResultSummary\` field.
            -   **Crucial for Text Tasks:** If the user's goal was a question or analysis (e.g., "What is the capital of X?", "Summarize this report"), the summary MUST contain the *actual answer* or *key findings*, not just a statement that the task was completed (e.g., do NOT say "I found the answer", say "The answer is X").
        5.  **MANDATORY: Set Status:** Finally, set the \`status\` to "completed".

**Final Output Structure:**
If the goal is to create a "project repository" or a runnable application, the final set of artifacts should represent a complete file structure. This includes source code files (e.g., \`index.ts\`, \`App.tsx\`), dependency files (\`package.json\`), build configuration (\`tsconfig.json\`, \`vite.config.ts\`), and public assets (\`index.html\`). The final consolidation step should ensure all these files are present and correctly structured.

**Current State:**
You are on iteration ${currentState.currentIteration + 1} of ${currentState.maxIterations}.
The current state of the workflow is provided below in JSON format. Note: for brevity, the run log may be truncated. Do not repeat it in your response.

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
        resultType: { type: Type.STRING, description: "The type of result, either 'code' or 'text'. Should be set by the QA agent upon completion." }
    },
    required: ['goal', 'maxIterations', 'currentIteration', 'status', 'runLog', 'state', 'finalResultMarkdown', 'finalResultSummary']
};


const _runGoogleWorkflow = async (currentState: WorkflowState, settings: ProviderSettings, ragContent?: string): Promise<WorkflowState> => {
    throw new Error("Google provider is not supported. Please use Ollama.");

    const prompt = getSystemPrompt(currentState, ragContent);

    const response = await ai.models.generateContent({
        model: settings.model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.7,
        },
    });

    try {
        const jsonText = response.text;
        const newState = JSON.parse(jsonText) as WorkflowState;
        return newState;
    } catch (e) {
        console.error("Failed to parse JSON response from Google:", response.text);
        throw new Error("The model returned an invalid response. Please try again.");
    }
};

const _runOllamaWorkflow = async (currentState: WorkflowState, settings: ProviderSettings, ragContent: string | undefined, fetchFn: typeof fetch): Promise<WorkflowState> => {
    const url = `${settings.baseURL}/api/generate`;
    const prompt = getSystemPrompt(currentState, ragContent);
    const body = {
        model: settings.model,
        prompt: prompt,
        format: 'json',
        stream: false,
    };
    
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetchFn(url, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errorText}`);
            }
            const responseData = await response.json();
            return JSON.parse(responseData.response) as WorkflowState;
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    throw lastError || new Error("Ollama request failed after 3 attempts");
};

const _runOpenAIWorkflow = async (currentState: WorkflowState, settings: ProviderSettings, ragContent: string | undefined, fetchFn: typeof fetch): Promise<WorkflowState> => {
    if (!settings.apiKey) {
        throw new Error(`API key is missing for ${settings.baseURL}.`);
    }
    const url = `${settings.baseURL}/chat/completions`;
    const prompt = getSystemPrompt(currentState, ragContent);
    const body = {
        model: settings.model,
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
    };
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
    };
    const response = await fetchFn(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error for ${settings.baseURL} (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    try {
        return JSON.parse(data.choices[0].message.content) as WorkflowState;
    } catch (e) {
        console.error(`Failed to parse JSON from ${settings.baseURL} response:`, data.choices[0].message.content);
        throw new Error("The model returned invalid JSON.");
    }
};

const _runClaudeWorkflow = async (currentState: WorkflowState, settings: ProviderSettings, ragContent: string | undefined, fetchFn: typeof fetch): Promise<WorkflowState> => {
    if (!settings.apiKey) {
        throw new Error("API key is missing for Claude provider.");
    }
    const url = `${settings.baseURL}/messages`;

    const systemPromptPart = getSystemPrompt(currentState, ragContent).split('**Current State:**')[0];
    const userPrompt = `
**Current State:**
You are on iteration ${currentState.currentIteration + 1} of ${currentState.maxIterations}.
The current state of the workflow is provided below in JSON format. Do not repeat it in your response.

\`\`\`json
${JSON.stringify(currentState, null, 2)}
\`\`\`

**Your Task:**
Perform the next logical agent action (Planner -> Worker -> QA).
You MUST respond with only the raw JSON object representing the full, updated workflow state. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\`. Your entire response must be the JSON object itself.
`;

    const body = {
        model: settings.model,
        max_tokens: 4096,
        system: systemPromptPart,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
    };
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
    };
    
    const response = await fetchFn(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    try {
        const responseText = data.content[0].text;
        const jsonMatch = responseText.match(/{[\s\S]*}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as WorkflowState;
        }
        throw new Error("No valid JSON object found in the response.");
    } catch (e) {
        console.error("Failed to parse JSON from Claude response:", data.content[0]?.text, e);
        throw new Error("Claude returned a response that could not be parsed as JSON.");
    }
};

const _runOpenRouterWorkflow = async (currentState: WorkflowState, settings: ProviderSettings, ragContent: string | undefined, fetchFn: typeof fetch): Promise<WorkflowState> => {
    // OpenRouter uses the OpenAI-compatible API
    return _runOpenAIWorkflow(currentState, settings, ragContent, fetchFn);
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
    
    let newState: WorkflowState;

    switch (provider) {
        case 'google':
            newState = await _runGoogleWorkflow(currentState, providerSettings, ragContent);
            break;
        case 'ollama':
            newState = await _runOllamaWorkflow(currentState, providerSettings, ragContent, fetchFn);
            break;
        case 'openai':
            newState = await _runOpenAIWorkflow(currentState, providerSettings, ragContent, fetchFn);
            break;
        case 'claude':
            newState = await _runClaudeWorkflow(currentState, providerSettings, ragContent, fetchFn);
            break;
        case 'openrouter':
            newState = await _runOpenRouterWorkflow(currentState, providerSettings, ragContent, fetchFn);
            break;
        case 'groq':
        case 'samba':
        case 'cerberus':
            // Assume OpenAI-compatible API
            newState = await _runOpenAIWorkflow(currentState, providerSettings, ragContent, fetchFn);
            break;
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }

    const ragQueryArtifact = newState.state.artifacts.find(a => a.key === 'rag_query');
    const internetQueryArtifact = newState.state.artifacts.find(a => a.key === 'internet_query');

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
            newState.state.notes = `Search completed for "${query}". Results available in 'rag_results' artifact.`;
        } else {
            newState.state.notes = `No artifacts or documents available to search.`;
        }
    }

    if (internetQueryArtifact) {
        newState.state.artifacts = newState.state.artifacts.filter(a => a.key !== 'internet_query');
        const query = internetQueryArtifact.value;
        
        try {
            const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
            const response = await fetchFn(searchUrl);
            const data = await response.json();
            const results = data.RelatedTopics?.slice(0, 5).map((t: any) => t.Text || t.FirstURL).join('\n\n') || 'No results found.';
            newState.state.artifacts.push({ key: 'internet_results', value: results });
            newState.state.notes = `Internet search completed for "${query}". Results available in 'internet_results' artifact.`;
        } catch (e) {
            newState.state.artifacts.push({ key: 'internet_results', value: 'Internet search failed. Please try a different query.' });
            newState.state.notes = `Internet search failed for "${query}".`;
        }
    }

    return newState;
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
            case 'google':
                throw new Error("Google provider is not supported. Please use Ollama.");
            case 'ollama':
                const ollamaUrl = `${providerSettings.baseURL}/api/tags`;
                const ollamaResp = await fetchFn(ollamaUrl);
                if (!ollamaResp.ok) throw new Error(`Ollama connection failed: ${ollamaResp.statusText}`);
                const ollamaData = await ollamaResp.json();
                return Array.isArray(ollamaData.models);
            case 'openai':
            case 'openrouter':
            case 'groq':
            case 'samba':
            case 'cerberus':
                 if (!providerSettings.apiKey) throw new Error("API Key is missing.");
                const url = `${providerSettings.baseURL}/models`;
                const headers = { 'Authorization': `Bearer ${providerSettings.apiKey}` };
                const resp = await fetchFn(url, { headers });
                if (!resp.ok) throw new Error(`Connection failed: ${resp.statusText}`);
                await resp.json();
                return true;
            case 'claude':
                 if (!providerSettings.apiKey) throw new Error("API Key is missing.");
                const claudeUrl = `${providerSettings.baseURL}/messages`;
                const claudeHeaders = { 'x-api-key': providerSettings.apiKey, 'anthropic-version': '2023-06-01' };
                 const claudeResp = await fetchFn(claudeUrl, { method: 'POST', headers: claudeHeaders, body: JSON.stringify({ model: providerSettings.model, max_tokens: 1, messages: [{role: 'user', content: 'test'}]}) });
                // Claude returns 400 for a bad request but it means auth is ok. 401/403 is a failure.
                if (claudeResp.status === 401 || claudeResp.status === 403) throw new Error(`Connection failed: ${claudeResp.statusText}`);
                return true;
            default:
                return false;
        }
    } catch (e) {
        console.error(`Connection test failed for ${provider}:`, e);
        throw e;
    }
};
