import { describe, it, expect } from '../utils/testRunner';
import { runWorkflowIteration } from '../services/be-workflowService';
import type { LLMSettings, WorkflowState } from '../types';

const BASE_STATE: WorkflowState = {
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

const makeSettings = (baseURL = 'http://localhost:11434', model = 'llama3.3:latest'): LLMSettings => ({
    provider: 'ollama',
    ollama: { model, baseURL }
});

/**
 * Executes integration tests for the core workflow service.
 */
export const runIntegrationTests = () => {
    describe('Workflow Service Integration', () => {

        it('should call the Ollama provider and parse workflow state', async () => {
            let fetchCalled = false;
            const mockFetch = async (url: any, options: any) => {
                fetchCalled = true;
                expect(url).toBe('http://localhost:11434/api/generate');
                const body = JSON.parse(options.body);
                expect(body.model).toBe('llama3.3:latest');
                expect(body.format).toBe('json');
        
                return {
                    ok: true,
                    json: async () => ({
                        response: JSON.stringify({
                            ...BASE_STATE,
                            state: { ...BASE_STATE.state, steps: ["Step 1", "Step 2"], initialPlan: ["Step 1", "Step 2"], notes: "Planner ready" },
                            runLog: [{ iteration: 1, agent: 'Planner', summary: 'Created initial plan.' }]
                        })
                    })
                } as any;
            };
        
            const settings = makeSettings();
            const newState = await runWorkflowIteration(BASE_STATE, settings, undefined, mockFetch);
            expect(fetchCalled).toBeTruthy();
            expect(newState.state.steps.length).toBe(2);
            expect(newState.runLog.length).toBe(1);
        });

        it('should return an error state after two failures with log entry', async () => {
            let attempts = 0;
            const mockFetch = async () => {
                attempts += 1;
                throw new Error('Network down');
            };

            const settings = makeSettings();
            const newState = await runWorkflowIteration(BASE_STATE, settings, undefined, mockFetch as any);
            expect(attempts).toBe(2);
            expect(newState.status).toBe('error');
            expect(newState.state.notes.includes('Workflow error')).toBeTruthy();
            expect(newState.runLog.length).toBe(1);
        });

        it('should handle the RAG flow and append results/notes', async () => {
            const stateWithRagQuery: WorkflowState = {
                ...BASE_STATE,
                state: {
                    ...BASE_STATE.state,
                    artifacts: [{ key: 'rag_query', value: 'security protocol' }]
                }
            };
            
            const mockFetch = async () => ({
                ok: true,
                json: async () => ({
                    response: JSON.stringify({
                        ...stateWithRagQuery,
                        state: { ...stateWithRagQuery.state, notes: 'Waiting for RAG results' }
                    })
                })
            } as any);

            const settings = makeSettings();
            const ragContent = "Always use HTTPS for secure transport.";
            const newState = await runWorkflowIteration(stateWithRagQuery, settings, ragContent, mockFetch);
            
            const ragQuery = newState.state.artifacts.find(a => a.key === 'rag_query');
            expect(ragQuery).toBeUndefined();

            const ragResults = newState.state.artifacts.find(a => a.key === 'rag_results');
            expect(ragResults).toBeTruthy();
            expect(ragResults?.value.includes('HTTPS')).toBeTruthy();
            expect(newState.state.notes.includes('Search completed')).toBeTruthy();
        });

        it('should run internet search and preserve notes', async () => {
            const stateWithInternetQuery: WorkflowState = {
                ...BASE_STATE,
                state: {
                    ...BASE_STATE.state,
                    notes: 'Original note',
                    artifacts: [{ key: 'internet_query', value: 'llama3 news' }]
                }
            };

            const mockFetch = async (url: any) => {
                if (String(url).includes('/api/generate')) {
                    return {
                        ok: true,
                        json: async () => ({
                            response: JSON.stringify({
                                ...stateWithInternetQuery,
                                state: { ...stateWithInternetQuery.state }
                            })
                        })
                    } as any;
                }

                return {
                    ok: true,
                    json: async () => ({
                        RelatedTopics: [{ Text: 'LLAMA3 released' }]
                    })
                } as any;
            };

            const settings = makeSettings();
            const newState = await runWorkflowIteration(stateWithInternetQuery, settings, undefined, mockFetch as any);

            const internetResults = newState.state.artifacts.find(a => a.key === 'internet_results');
            expect(internetResults).toBeTruthy();
            expect(internetResults?.value.includes('LLAMA3')).toBeTruthy();
            expect(newState.state.notes.includes('Original note')).toBeTruthy();
        });
    });
};
