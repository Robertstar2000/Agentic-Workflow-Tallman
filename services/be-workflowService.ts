
import { GoogleGenAI, Type } from "@google/genai";
import type { LLMSettings, WorkflowState, ProviderSettings } from "../types";

const GOOGLE_API_KEY = process.env.API_KEY;

const getSystemPrompt = (currentState: WorkflowState) => {
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

    return `${contextReminder}
You are an intelligent automation platform executing a complex, multi-step workflow.
Your goal is to achieve the user's objective by breaking it down into steps and iterating until completion.
You operate in a loop of three agents: Planner, Worker, and QA.

**Workflow Execution Flow:**

1.  **Planner:** Your first task is always to act as the Planner. Analyze the goal and the current state.
    -   **First Run:** If the 'steps' array is empty, this is the first planning phase. You MUST create a detailed, ordered list of steps to achieve the goal and populate the 'steps' array. At the same time, you MUST copy this initial list of steps into a new field called 'initialPlan'.
    -   **Subsequent Runs:** If 'steps' already exist, select the next step to execute or update the 'steps' list if the plan needs to change.
    -   **Crucially, the 'initialPlan' field must NEVER be modified after it is first created.** It serves as a permanent record of the original strategy.
    -   Update the 'progress' field and log your action to the run log.
2.  **Worker:** After the Planner, you act as the Worker. Execute the current step defined by the Planner. You can create or modify 'artifacts' by adding to or updating the 'artifacts' array. For complex values (objects, arrays), you MUST JSON.stringify them and store the resulting string in the 'value' field of the artifact object. Update the 'progress' field. Log your action.
3.  **QA:** After the Worker, you act as the QA agent. Compare the original goal against the current state and artifacts. If the goal is fully achieved, set status to "completed" and generate the final 'finalResultMarkdown' and 'finalResultSummary'. If the goal is not met, provide specific, concrete feedback and instructions in the 'notes' field for the Planner's next iteration. Set status back to "running". If you are stuck or the goal is ambiguous, set status to "needs_clarification" and write clarifying questions in the notes.

**Current State:**
You are on iteration ${currentState.currentIteration + 1} of ${currentState.maxIterations}.
The current state of the workflow is provided below in JSON format. Do not repeat it in your response.

\`\`\`json
${JSON.stringify(currentState, null, 2)}
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
        finalResultSummary: { type: Type.STRING }
    },
    required: ['goal', 'maxIterations', 'currentIteration', 'status', 'runLog', 'state', 'finalResultMarkdown', 'finalResultSummary']
};


const _runGoogleWorkflow = async (currentState: WorkflowState, settings: ProviderSettings): Promise<WorkflowState> => {
     if (!GOOGLE_API_KEY) {
        throw new Error("Google API key is not set in environment variables.");
    }
    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    const prompt = getSystemPrompt(currentState);

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

const _runOllamaWorkflow = async (currentState: WorkflowState, settings: ProviderSettings): Promise<WorkflowState> => {
    const url = `${settings.baseURL}/api/generate`;
    const prompt = getSystemPrompt(currentState);
    const body = {
        model: settings.model,
        prompt: prompt,
        format: 'json',
        stream: false,
    };
    const response = await fetch(url, {
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

// Placeholder for OpenAI
const _runOpenAIWorkflow = async (currentState: WorkflowState, settings: ProviderSettings): Promise<WorkflowState> => {
    console.warn("OpenAI provider is not fully implemented.");
    throw new Error("OpenAI provider not implemented.");
    // Example implementation:
    // const url = `${settings.baseURL}/chat/completions`;
    // const prompt = getSystemPrompt(currentState);
    // const body = { model: settings.model, messages: [{ role: 'system', content: prompt }], response_format: { type: 'json_object' } };
    // const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` };
    // const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    // const data = await response.json();
    // return JSON.parse(data.choices[0].message.content) as WorkflowState;
};

// Placeholder for Claude
const _runClaudeWorkflow = async (currentState: WorkflowState, settings: ProviderSettings): Promise<WorkflowState> => {
    console.warn("Claude provider is not fully implemented.");
    throw new Error("Claude provider not implemented.");
};

// Placeholder for OpenRouter
const _runOpenRouterWorkflow = async (currentState: WorkflowState, settings: ProviderSettings): Promise<WorkflowState> => {
    console.warn("OpenRouter provider is not fully implemented.");
    throw new Error("OpenRouter provider not implemented.");
};


export const runWorkflowIteration = async (currentState: WorkflowState, settings: LLMSettings): Promise<WorkflowState> => {
    const provider = settings.provider;
    const providerSettings = settings[provider];
    
    switch (provider) {
        case 'google':
            return _runGoogleWorkflow(currentState, providerSettings);
        case 'ollama':
            return _runOllamaWorkflow(currentState, providerSettings);
        case 'openai':
            return _runOpenAIWorkflow(currentState, providerSettings);
        case 'claude':
            return _runClaudeWorkflow(currentState, providerSettings);
        case 'openrouter':
            return _runOpenRouterWorkflow(currentState, providerSettings);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
};

export const testProviderConnection = async (settings: LLMSettings): Promise<boolean> => {
    const provider = settings.provider;
    const providerSettings = settings[provider];

    try {
        switch (provider) {
            case 'google':
                 if (!GOOGLE_API_KEY) throw new Error("Google API Key not available.");
                 // A simple check as we can't list models easily. Assume key is valid if present.
                return true;
            case 'ollama':
                const ollamaUrl = `${providerSettings.baseURL}/api/tags`;
                const ollamaResp = await fetch(ollamaUrl);
                if (!ollamaResp.ok) throw new Error(`Ollama connection failed: ${ollamaResp.statusText}`);
                const ollamaData = await ollamaResp.json();
                return Array.isArray(ollamaData.models);
            case 'openai':
            case 'openrouter':
                 if (!providerSettings.apiKey) throw new Error("API Key is missing.");
                const url = `${providerSettings.baseURL}/models`;
                const headers = { 'Authorization': `Bearer ${providerSettings.apiKey}` };
                const resp = await fetch(url, { headers });
                if (!resp.ok) throw new Error(`Connection failed: ${resp.statusText}`);
                await resp.json();
                return true;
            case 'claude':
                 if (!providerSettings.apiKey) throw new Error("API Key is missing.");
                const claudeUrl = `${providerSettings.baseURL}/messages`;
                const claudeHeaders = { 'x-api-key': providerSettings.apiKey, 'anthropic-version': '2023-06-01' };
                 const claudeResp = await fetch(claudeUrl, { method: 'POST', headers: claudeHeaders, body: JSON.stringify({ model: providerSettings.model, max_tokens: 1, messages: [{role: 'user', content: 'test'}]}) });
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