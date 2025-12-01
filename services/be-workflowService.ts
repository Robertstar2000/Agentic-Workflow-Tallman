
import { GoogleGenAI, Type } from "@google/genai";
import type { LLMSettings, WorkflowState, ProviderSettings } from "../types";

const GOOGLE_API_KEY = process.env.API_KEY;

/**
 * Creates a summarized and truncated version of the workflow state to be used in the LLM prompt,
 * preventing the context from growing too large.
 * @param {WorkflowState} state - The full current state of the workflow.
 * @returns {object} A sanitized state object suitable for including in the prompt.
 */
const prepareStateForPrompt = (state: WorkflowState): object => {
    const stateForPrompt = JSON.parse(JSON.stringify(state)); // Deep copy

    const MAX_LOG_ENTRIES = 10;

    // Truncate runLog, keeping the most recent entries
    if (stateForPrompt.runLog.length > MAX_LOG_ENTRIES) {
        stateForPrompt.runLog = stateForPrompt.runLog.slice(-MAX_LOG_ENTRIES);
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

    const ragInstruction = ragContent ? `
**Knowledge Document Available:** A document has been uploaded by the user. You can search it for specific information.
To search the document, act as the Worker and create an artifact with the key \`rag_query\` and the value as your search query (e.g., { "key": "rag_query", "value": "what is the security protocol" }).
After creating the artifact, end your turn by updating the 'notes' field to indicate you are waiting for search results. The system will perform the search, and the results will be available in an artifact named \`rag_results\` in the next iteration. Do not try to create the \`rag_results\` artifact yourself.
` : '';

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
    -   **First Run:** If the 'steps' array is empty, this is the first planning phase. You MUST perform two actions: 1. Create a detailed, ordered list of steps to achieve the goal and populate BOTH the 'steps' array and the 'initialPlan' field. The 'initialPlan' field must not be modified after this. 2. Create a new artifact with the key \`requirements_specification.md\`. The value of this artifact MUST be a markdown document containing the user's original goal and the full list of steps you just created.
    -   **Final Consolidation Step:** Your plan MUST conclude with a final step to consolidate all work. Examples: 'Consolidate all generated code into a final directory structure.', 'Combine all research notes into a final summary document.', or 'Organize all data into a final CSV spreadsheet.' This step is mandatory.
    -   **Subsequent Runs:** If 'steps' already exist, find the next incomplete step from the list. You MUST update the 'progress' field with the text "Working on step X..." where X is the 1-based index of that step. For example, if you are starting the second step, the progress MUST be "Working on step 2...". Only update the 'steps' list if the plan needs to change. After setting the progress, log your action to the run log.
    -   **Crucially, the 'initialPlan' field must NEVER be modified after it is first created.** It serves as a permanent record of the original strategy.
2.  **Worker:** After the Planner, you act as the Worker. Execute the current step defined by the Planner.
    -   **CRITICAL RULE: Save All Work.** You are REQUIRED to save ANY and ALL files, documents, code snippets, or data structures you generate as an artifact. There are no exceptions. If a step involves creating something, your action MUST result in a new entry in the 'artifacts' array. Use a descriptive key for the artifact (e.g., 'final_report.md', 'component.tsx', 'style_guide.css').
    -   **Code Generation:** When a step requires generating code, you MUST write it in TypeScript (\`.ts\`/\`.tsx\`) or JavaScript (\`.js\`). All code artifacts must have the appropriate file extension.
    -   **Web Design:** When generating an \`index.html\` file, you MUST always include CSS styling (colors, fonts, layout) to make the page visually appealing. Use a modern aesthetic (e.g., clean fonts, generous padding, soft shadows). To ensure the page is easily runnable, PREFER including CSS and JavaScript INLINE within the HTML file rather than as separate files, unless the project is very complex.
    -   **Data Exports:** If the user requests a table, Excel file, or SQL query, you MUST generate a specific artifact for it (e.g., \`export.csv\`, \`query.sql\`). This allows the user to download the data directly. For Excel requests, prefer generating a CSV file.
    -   For complex values (objects, arrays), you MUST JSON.stringify them and store the resulting string in the 'value' field of the artifact object. Update the 'progress' field. Log your action.
3.  **QA:** After the Worker, you act as the QA agent.
    -   **Review:** Compare the original goal against the current state and artifacts.
    -   **If Not Complete:** If the goal is not met, provide specific, concrete feedback and instructions in the 'notes' field for the Planner's next iteration. Set status back to "running". If you are stuck or the goal is ambiguous, set status to "needs_clarification" and write clarifying questions in the notes.
    -   **If Complete:** If the goal is fully achieved, you MUST perform the following final steps in order:
        1.  **Categorize Result:** First, determine if the primary output is 'code' (e.g., a software project, scripts) or 'text' (e.g., a report, analysis, story). Set the \`resultType\` field in the root of the state object to either "code" or "text". This field is mandatory for a completed status.
        2.  **Generate README:** Create a comprehensive \`README.md\` file as a new artifact. This file is the primary deliverable. Its content should be professionally formatted and inspired by high-quality open-source projects (like \`cline/cline\` on GitHub). It MUST include:
            -   A clear title and a concise one-sentence summary of the project.
            -   An "Overview" section explaining the project's purpose and key features.
            -   A "Getting Started" or "Usage" section with instructions. If \`resultType\` is "code", this means installation (\`npm install\`) and execution (\`npm run dev\`) commands. If \`resultType\` is "text", this means explaining the findings or how to read the report.
            -   A "Technical Details" or "Methodology" section if applicable, detailing architecture or dependencies.
        3.  **Update State:** Add the new \`README.md\` artifact to the \`artifacts\` array.
        4.  **Set Final Outputs:** Set the \`finalResultMarkdown\` field to the **exact same content** as the \`README.md\` artifact. Generate a brief, user-friendly summary of the project's outcome and put it in the \`finalResultSummary\` field.
            -   **Crucial for Text Tasks:** If the user's goal was a question or analysis (e.g., "What is the capital of X?", "Summarize this report"), the summary MUST contain the *actual answer* or *key findings*, not just a statement that the task was completed (e.g., do NOT say "I found the answer", say "The answer is X").
        5.  **Set Status:** Finally, set the \`status\` to "completed".

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
     if (!GOOGLE_API_KEY) {
        throw new Error("Google API key is not set in environment variables.");
    }
    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

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
    try {
        return JSON.parse(responseData.response) as WorkflowState;
    } catch (e) {
        console.error("Failed to parse JSON from Ollama response:", responseData.response);
        throw new Error("Ollama returned invalid JSON.");
    }
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

    if (ragQueryArtifact) {
        newState.state.artifacts = newState.state.artifacts.filter(a => a.key !== 'rag_query');
        if (ragContent) {
            const query = ragQueryArtifact.value;
            const ragResults = _executeRAG(query, ragContent);
            newState.state.artifacts.push({ key: 'rag_results', value: ragResults });
            newState.state.notes = `I have completed the requested search for "${query}". The results are now available in the 'rag_results' artifact. Please review them and continue with your task.`;
        } else {
            newState.state.notes = `You requested a search, but no knowledge document has been provided by the user. Please proceed with the task using your existing knowledge.`;
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
                 if (!GOOGLE_API_KEY) throw new Error("Google API Key not available.");
                 // A simple check as we can't list models easily. Assume key is valid if present.
                return true;
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
