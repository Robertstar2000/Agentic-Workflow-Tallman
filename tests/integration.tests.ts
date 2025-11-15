import { describe, it, expect } from '../utils/testRunner';
import { runWorkflowIteration } from '../services/be-workflowService';
import type { LLMSettings, WorkflowState } from '../types';

const MOCK_STATE: WorkflowState = {
    goal: "Test goal",
    maxIterations: 10,
    currentIteration: 0,
    status: 'running',
    runLog: [],
    state: {
        goal: "Test goal",
        steps: [],
        artifacts: [],
        notes: "Initial state.",
        progress: 'Not started',
    },
    finalResultMarkdown: '',
    finalResultSummary: '',
};

const MOCK_LLM_RESPONSE: WorkflowState = {
    ...MOCK_STATE,
    currentIteration: 0, 
    state: {
        ...MOCK_STATE.state,
        notes: "Planner has created a plan.",
        steps: ["Step 1", "Step 2"],
        initialPlan: ["Step 1", "Step 2"],
    },
    runLog: [{ iteration: 1, agent: 'Planner', summary: 'Created initial plan.' }]
};

/**
 * Executes integration tests for the core workflow service.
 */
export const runIntegrationTests = () => {
    describe('Workflow Service Integration', () => {

        it('should call the OpenAI provider correctly', async () => {
            let fetchCalled = false;
            const mockFetch = async (url: any, options: any) => {
                fetchCalled = true;
                expect(url).toBe('https://api.openai.com/v1/chat/completions');
                const body = JSON.parse(options.body);
                expect(body.model).toBe('gpt-4o');
                expect(options.headers['Authorization']).toBe('Bearer test-key');

                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: JSON.stringify(MOCK_LLM_RESPONSE) } }]
                    })
                } as any;
            };

            const settings: LLMSettings = {
                provider: 'openai',
                openai: { apiKey: 'test-key', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
                google: { model: 'gemini-2.5-pro' },
                claude: { apiKey: '', model: ''},
                openrouter: { apiKey: '', model: ''},
                ollama: { model: ''},
            };

            const newState = await runWorkflowIteration(MOCK_STATE, settings, undefined, mockFetch);
            expect(fetchCalled).toBeTruthy();
            expect(newState.state.notes).toBe(MOCK_LLM_RESPONSE.state.notes);
        });


        it('should handle the RAG flow correctly', async () => {
            const stateWithRagQuery: WorkflowState = {
                ...MOCK_STATE,
                state: {
                    ...MOCK_STATE.state,
                    artifacts: [{ key: 'rag_query', value: 'search for protocol' }]
                }
            };
            
            // Mock LLM to return the state *with* the rag_query still in it
             const mockLLMResponseWithRag: WorkflowState = {
                ...stateWithRagQuery,
                runLog: [{ iteration: 1, agent: 'Worker', summary: 'Querying knowledge base.' }],
                state: { ...stateWithRagQuery.state, notes: 'Waiting for RAG results' }
            };

            const mockFetch = async () => ({
                ok: true,
                json: async () => ({
                    choices: [{ message: { content: JSON.stringify(mockLLMResponseWithRag) } }]
                })
            } as any);


            const settings: LLMSettings = {
                provider: 'openai',
                openai: { apiKey: 'test-key', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
                google: { model: 'gemini-2.5-pro' },
                claude: { apiKey: '', model: ''},
                openrouter: { apiKey: '', model: ''},
                ollama: { model: ''},
            };
            
            const ragContent = "The main security protocol is to always use HTTPS.";
            const newState = await runWorkflowIteration(stateWithRagQuery, settings, ragContent, mockFetch);
            
            // Check that the rag_query artifact was removed
            const ragQuery = newState.state.artifacts.find(a => a.key === 'rag_query');
            expect(ragQuery).toBeUndefined();

            // Check that the rag_results artifact was added
            const ragResults = newState.state.artifacts.find(a => a.key === 'rag_results');
            expect(ragResults).toBeTruthy();
            expect(ragResults?.value.includes('security protocol')).toBeTruthy();
            expect(newState.state.notes.includes("I have completed the requested search")).toBeTruthy();
        });
    });
};