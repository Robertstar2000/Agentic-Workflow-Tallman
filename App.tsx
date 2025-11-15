import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { WorkflowInput } from './components/WorkflowInput';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { HelpModal } from './components/HelpModal';
import { runWorkflowIteration } from './services/be-workflowService';
import type { LLMSettings, WorkflowState } from './types';
import { Tip } from './components/Tip';
import { decrypt } from './utils/crypto';
import { Footer } from './components/Footer';


const DEFAULT_SETTINGS: LLMSettings = {
    provider: 'google',
    google: { model: 'gemini-2.5-flash' },
    openai: { apiKey: '', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' },
    claude: { apiKey: '', model: 'claude-3-opus-20240229', baseURL: 'https://api.anthropic.com/v1' },
    openrouter: { apiKey: '', model: 'openai/gpt-4o', baseURL: 'https://openrouter.ai/api/v1' },
    ollama: { model: 'llama3', baseURL: 'http://localhost:11434' },
};


const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [goal, setGoal] = useState('');
    const [maxIterations, setMaxIterations] = useState(50);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = localStorage.getItem('ai-workflow-settings');
                if (savedSettings) {
                    const parsedSettings = JSON.parse(savedSettings) as LLMSettings;

                    // Decrypt API keys
                    if (parsedSettings.openai.apiKey) {
                        parsedSettings.openai.apiKey = await decrypt(parsedSettings.openai.apiKey);
                    }
                    if (parsedSettings.claude.apiKey) {
                        parsedSettings.claude.apiKey = await decrypt(parsedSettings.claude.apiKey);
                    }
                    if (parsedSettings.openrouter.apiKey) {
                        parsedSettings.openrouter.apiKey = await decrypt(parsedSettings.openrouter.apiKey);
                    }
                    
                    // Merge with defaults to ensure all keys are present
                    setSettings(prev => ({...prev, ...parsedSettings}));
                }
            } catch (e) {
                console.error("Failed to parse or decrypt settings from localStorage", e);
            }
        };

        loadSettings();
    }, []);

    const handleRunWorkflow = useCallback(async (overrides?: { goal?: string; maxIterations?: number }) => {
        const effectiveGoal = overrides?.goal ?? goal;
        const effectiveMaxIterations = overrides?.maxIterations ?? maxIterations;

        if (!effectiveGoal.trim()) {
            setError('Please enter a goal.');
            return;
        }
        setIsRunning(true);
        setError(null);
        
        // If overrides were passed, update the state for UI consistency
        if (overrides?.goal) setGoal(overrides.goal);
        if (overrides?.maxIterations) setMaxIterations(overrides.maxIterations);

        let currentState: WorkflowState = {
            goal: effectiveGoal,
            maxIterations: effectiveMaxIterations,
            currentIteration: 0,
            status: 'running',
            runLog: [],
            state: {
                goal: effectiveGoal,
                steps: [],
                artifacts: [],
                notes: 'Initial state. Planner needs to create steps.',
                progress: 'Not started',
            },
            finalResultMarkdown: '',
            finalResultSummary: '',
        };
        setWorkflowState(currentState);

        try {
            for (let i = 1; i <= effectiveMaxIterations; i++) {
                const newState = await runWorkflowIteration(currentState, settings);
                
                currentState = { ...newState, currentIteration: i };
                setWorkflowState(currentState);

                if (currentState.status === 'completed' || currentState.status === 'needs_clarification') {
                    break;
                }
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during the workflow.');
            const finalState = {...currentState, status: 'error' as const};
            setWorkflowState(finalState);
        } finally {
            setIsRunning(false);
        }
    }, [goal, maxIterations, settings]);

    const handleRunWorkflowFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("Failed to read file content.");
                }
                const data = JSON.parse(text);

                const goalFromFile = data.goal || data.state?.goal;
                const maxIterationsFromFile = data.maxIterations;

                if (typeof goalFromFile !== 'string' || !goalFromFile.trim()) {
                    throw new Error("Input JSON must contain a non-empty 'goal' string.");
                }
                
                await handleRunWorkflow({
                    goal: goalFromFile,
                    maxIterations: (maxIterationsFromFile && typeof maxIterationsFromFile === 'number') ? maxIterationsFromFile : undefined
                });

            } catch (err) {
                setError(err instanceof Error ? `Error processing file: ${err.message}` : 'An unknown error occurred while processing the file.');
            }
        };
        reader.onerror = () => {
            setError(`Failed to read the file: ${reader.error?.message}`);
        };
        reader.readAsText(file);
    };

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8 flex flex-col">
            <div className="w-full max-w-5xl mx-auto flex-grow">
                <Header 
                    isAuthenticated={isAuthenticated} 
                    onLoginClick={() => setIsAuthModalOpen(true)}
                    onLogoutClick={() => setIsAuthenticated(false)}
                    onSettingsClick={() => setIsSettingsOpen(true)}
                    onHelpClick={() => setIsHelpModalOpen(true)}
                />
                <main className="mt-8">
                    <div className="bg-card-bg border border-border-muted rounded-xl shadow-2xl p-6 backdrop-blur-lg">
                        <WorkflowInput
                            goal={goal}
                            setGoal={setGoal}
                            maxIterations={maxIterations}
                            setMaxIterations={setMaxIterations}
                            isRunning={isRunning}
                            isAuthenticated={isAuthenticated}
                            onRunWorkflow={() => handleRunWorkflow()}
                            onRunWorkflowFromFile={handleRunWorkflowFromFile}
                            onLoginClick={() => setIsAuthModalOpen(true)}
                        />
                        <Tip />
                    </div>

                    {error && (
                         <div className="mt-6 bg-red-900/50 border border-error text-error p-4 rounded-lg text-center">
                            <p className="font-semibold">Error</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    
                    <div className="mt-8">
                        {workflowState ? (
                            <ResultsDisplay state={workflowState} />
                        ) : (
                             <div className="text-center text-text-muted py-12">
                                <p>Run the workflow to see a detailed summary...</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <Footer />
            {isSettingsOpen && (
                <SettingsModal 
                    settings={settings}
                    setSettings={setSettings}
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}
            {isAuthModalOpen && (
                <AuthModal
                    onClose={() => setIsAuthModalOpen(false)}
                    onAuthenticated={() => setIsAuthenticated(true)}
                />
            )}
            {isHelpModalOpen && (
                <HelpModal onClose={() => setIsHelpModalOpen(false)} />
            )}
        </div>
    );
};

export default App;