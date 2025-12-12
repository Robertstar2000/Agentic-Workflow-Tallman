
import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { WorkflowInput } from './components/WorkflowInput';
import { ResultsDisplay } from './components/ResultsDisplay';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { HelpModal } from './components/HelpModal';
import { runWorkflowIteration } from './services/be-workflowService';
import type { LLMSettings, WorkflowState, Artifact } from './types';
import { Tip } from './components/Tip';
import { decrypt } from './utils/crypto';
import { Footer } from './components/Footer';
import { PlanSidebar } from './components/PlanSidebar';
import { PlanApprovalModal } from './components/PlanApprovalModal';
import { OLLAMA_CONFIG } from './services/ollamaService';


const DEFAULT_SETTINGS: LLMSettings = {
    provider: 'ollama',
    ollama: { model: OLLAMA_CONFIG.model, baseURL: OLLAMA_CONFIG.host },
};

/**
 * Main application component.
 * Manages the overall state of the workflow, settings, and modals.
 */
const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [goal, setGoal] = useState('');
    const [maxIterations, setMaxIterations] = useState(50);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
    const [guidanceMode, setGuidanceMode] = useState<'auto' | 'human'>('auto');
    const [isAwaitingApproval, setIsAwaitingApproval] = useState(false);
    const [serviceStatus, setServiceStatus] = useState({
        backend: 'checking',
        ollama: 'checking',
        ldap: 'checking'
    });
    const [goalFileArtifacts, setGoalFileArtifacts] = useState<Artifact[]>([]);
    const [goalImageArtifacts, setGoalImageArtifacts] = useState<Artifact[]>([]);

    const checkServices = async () => {
        // Check backend
        try {
            const backendResponse = await fetch('http://localhost:3560/api/health');
            setServiceStatus(prev => ({ ...prev, backend: backendResponse.ok ? 'online' : 'offline' }));
        } catch {
            setServiceStatus(prev => ({ ...prev, backend: 'offline' }));
        }

        // Check Ollama
        try {
            const ollamaResponse = await fetch('http://10.10.20.24:11434/api/tags');
            setServiceStatus(prev => ({ ...prev, ollama: ollamaResponse.ok ? 'online' : 'offline' }));
        } catch {
            setServiceStatus(prev => ({ ...prev, ollama: 'offline' }));
        }

        // Check LDAP
        try {
            const ldapResponse = await fetch('http://localhost:3100/api/health');
            setServiceStatus(prev => ({ ...prev, ldap: ldapResponse.ok ? 'online' : 'offline' }));
        } catch {
            setServiceStatus(prev => ({ ...prev, ldap: 'offline' }));
        }
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedSettings = localStorage.getItem('ai-workflow-settings');
                if (savedSettings) {
                    const parsedSettings = JSON.parse(savedSettings) as LLMSettings;
                    // Merge with defaults to ensure all keys are present
                    setSettings(prev => ({...prev, ...parsedSettings}));
                }
            } catch (e) {
                console.error("Failed to parse or decrypt settings from localStorage", e);
            }

            // Check services after settings are loaded
            setTimeout(checkServices, 1000); // Small delay to ensure services are started
            setTimeout(checkServices, 4000); // Re-check to clear transient startup states
        };

        loadSettings();
    }, []);

    const runWorkflowLoop = async (initialState: WorkflowState, startIteration: number = 1) => {
        let currentState = initialState;
        let completionAttempts = 0;
        let qaIterations = 0;
        const stepIterations: { [key: number]: number } = {};
        let highestStepReached = 0;
        const maxStepRetries = 4;
        const mergeRunLogs = (a: WorkflowState['runLog'], b: WorkflowState['runLog']) => [...a, ...b].filter(Boolean);
        let pendingArtifacts: Artifact[] = [];

        const deriveStepNum = (state: WorkflowState, fallbackStep: number): number => {
            const match = state.state.progress?.match(/step (\d+)/i);
            if (match) return parseInt(match[1], 10);
            if (state.state.steps.length > 0) {
                return Math.max(1, fallbackStep || 1);
            }
            return 0;
        };
        try {
            for (let i = startIteration; i <= currentState.maxIterations; i++) {
                const stepNum = deriveStepNum(currentState, highestStepReached);

                if (stepNum > 0 && !currentState.state.progress?.match(/step (\d+)/i)) {
                    currentState.state.progress = `Working on step ${stepNum}...`;
                }

                // PREVENT BACKWARD STEP EXECUTION - CRITICAL VALIDATION
                if (stepNum > 0 && stepNum < highestStepReached) {
                    console.error(`BLOCKED: Attempted backward execution from step ${highestStepReached} to step ${stepNum}`);
                    setError(`Workflow error: Invalid backward execution to step ${stepNum}. Steps can only move forward.`);
                    const correctedState = {
                        ...currentState,
                        status: 'error' as const,
                        state: {
                            ...currentState.state,
                            progress: `Error: Invalid step progression detected`,
                            notes: `Blocked invalid backward execution to step ${stepNum}. Contact administrator.`
                        }
                    };
                    setWorkflowState(correctedState);
                    return;
                }

                if (stepNum > highestStepReached) {
                    highestStepReached = stepNum;
                }

                if (stepNum > 0) {
                    stepIterations[stepNum] = (stepIterations[stepNum] || 0) + 1;

                    if ((stepNum === 1 || stepNum === 2) && stepIterations[stepNum] > maxStepRetries) {
                        const nextStep = stepNum + 1;
                        if (nextStep <= currentState.state.steps.length) {
                            currentState.state.progress = `Working on step ${nextStep}...`;
                            currentState.state.notes = `Step ${stepNum} exceeded ${maxStepRetries} iterations. Moving to step ${nextStep}.`;
                            currentState.runLog = [
                                ...currentState.runLog,
                                { iteration: i, agent: 'QA', summary: `Auto-advanced from step ${stepNum} to step ${nextStep}` }
                            ];
                            highestStepReached = Math.max(highestStepReached, nextStep);
                        }
                    }
                }

                const prevArtifacts = currentState.state.artifacts;
                let newState = await runWorkflowIteration(currentState, settings);
                newState.runLog = mergeRunLogs(currentState.runLog, newState.runLog);

                // Ensure run log has an entry for this iteration
                const hasLogForIter = newState.runLog.some(entry => entry?.iteration === i);
                if (!hasLogForIter) {
                    const progressText = newState.state.progress || currentState.state.progress || 'Progress update';
                    const inferredAgent: 'Planner' | 'Worker' | 'QA' =
                        progressText.toLowerCase().includes('plan') ? 'Planner' :
                        progressText.toLowerCase().includes('qa') || progressText.toLowerCase().includes('review') ? 'QA' :
                        'Worker';
                    newState.runLog = [
                        ...newState.runLog,
                        { iteration: i, agent: inferredAgent, summary: progressText }
                    ];
                }

                // If planning produced steps but progress was not advanced, force start at step 1
                if (newState.state.steps.length > 0 && !/step\s+\d+/i.test(newState.state.progress || '')) {
                    newState.state.progress = 'Working on step 1...';
                    newState.runLog = [
                        ...newState.runLog,
                        { iteration: i, agent: 'Planner', summary: 'Initialized execution at step 1 after planning.' }
                    ];
                }

                // Delay committing artifacts until QA completes the loop
                const addedArtifacts = newState.state.artifacts.filter(a =>
                    !prevArtifacts.some(p => p.key === a.key && p.value === a.value)
                );
                const lastAgent = newState.runLog[newState.runLog.length - 1]?.agent;
                if (lastAgent !== 'QA') {
                    pendingArtifacts = [...pendingArtifacts, ...addedArtifacts];
                    newState.state.artifacts = prevArtifacts;
                } else {
                    newState.state.artifacts = [...prevArtifacts, ...pendingArtifacts, ...addedArtifacts];
                    pendingArtifacts = [];
                }

                // Validate step progression again after iteration
                const newStepNum = deriveStepNum(newState, highestStepReached);

                if (newStepNum > 0 && newStepNum < highestStepReached) {
                    console.error(`BLOCKED: LLM attempted backward execution to step ${newStepNum}`);
                    // Force forward progression by correcting the step
                    const correctedProgress = `Working on step ${highestStepReached + 1}...`;
                    newState.state.progress = correctedProgress;
                    newState.state.notes += ` (Corrected invalid step progression)`;
                    newState.runLog = [
                        ...newState.runLog,
                        { iteration: i, agent: 'QA', summary: `Corrected backward move to step ${newStepNum}; advanced to ${highestStepReached + 1}` }
                    ];
                    highestStepReached = highestStepReached + 1;
                } else if (newStepNum > highestStepReached) {
                    highestStepReached = newStepNum;
                }

                // Ensure required artifacts exist with correct names
                if (newState.state.steps.length > 0 && newState.state.initialPlan.length === 0) {
                    // Copy steps to initialPlan if it's empty
                    newState.state.initialPlan = [...newState.state.steps];
                }

                // Ensure Plan.md artifact exists if step 2 completed
                const planArtifactExists = newState.state.artifacts.some(a => a.key === 'Plan.md');
                if (!planArtifactExists && newState.state.steps.length >= 2) {
                    const planContent = `# Project Plan\n\n${newState.state.steps.map((step, idx) =>
                        `${idx + 1}. Step ${idx + 1} - ${step}`
                    ).join('\n')}\n\n## Details\nThis plan outlines the systematic approach to achieve the project goals through ${newState.state.steps.length} carefully sequenced steps.`;
                    newState.state.artifacts.push({
                        key: 'Plan.md',
                        value: planContent
                    });
                }

                // Ensure Requirements.md exists
                const requirementsExists = newState.state.artifacts.some(a => a.key === 'Requirements.md');
                if (!requirementsExists && newState.state.steps.length > 0) {
                    // Create a basic requirements artifact from the first step
                    const reqContent = `# Requirements Specification\n\n## Project Goal\n${newState.goal}\n\n## Implementation Steps\n1. ${newState.state.steps.join('\n1. ')}\n\n## Assumptions\n- Requirements are derived from the stated goal\n- Implementation follows the planned sequence\n- Each step builds upon previous work\n\n## Success Criteria\n- All planned steps completed\n- Final deliverables meet quality standards\n- Workflow executes without backward step regression`;
                    newState.state.artifacts.push({
                        key: 'Requirements.md',
                        value: reqContent
                    });
                }

                currentState = { ...newState, currentIteration: i };
                setWorkflowState(currentState);

                if (currentState.status === 'error') {
                    setError(currentState.state.notes || 'Workflow encountered an error.');
                    break;
                }

                const lastAgent = currentState.runLog[currentState.runLog.length - 1]?.agent;
                if (lastAgent === 'QA') {
                    qaIterations++;
                    const currentStep = deriveStepNum(currentState, highestStepReached);
                    const isFinalStep = currentState.state.steps.length > 0 && currentStep >= currentState.state.steps.length;

                    // Final step: limit QA to 1 loop, then finish with summary
                    if (isFinalStep && qaIterations >= 1 && currentState.status === 'running') {
                        const summaryContent = currentState.finalResultSummary?.trim()
                            || (currentState.finalResultMarkdown ? currentState.finalResultMarkdown.slice(0, 400) : '')
                            || (currentState.state.notes || 'Workflow completed.');
                        currentState = {
                            ...currentState,
                            status: 'completed',
                            finalResultSummary: summaryContent
                        };
                        currentState.runLog = [
                            ...currentState.runLog,
                            { iteration: currentState.currentIteration, agent: 'QA', summary: 'Final QA loop completed; workflow marked completed with summary.' }
                        ];
                        setWorkflowState(currentState);
                        break;
                    }

                    // Non-final steps: allow QA to rework only 1 loop, then auto-advance forward only
                    if (!isFinalStep && qaIterations >= 1 && currentState.status === 'running') {
                        const nextStep = currentStep > 0 ? Math.min(currentStep + 1, currentState.state.steps.length || currentStep + 1) : 0;
                        if (nextStep > currentStep) {
                            currentState.state.progress = `Working on step ${nextStep}...`;
                            currentState.state.notes = `${currentState.state.notes || ''} Auto-advanced after QA loop limit.`;
                            currentState.runLog = [
                                ...currentState.runLog,
                                { iteration: currentState.currentIteration, agent: 'QA', summary: `Auto-advanced to step ${nextStep} after QA review limit` }
                            ];
                            highestStepReached = Math.max(highestStepReached, nextStep);
                        }
                        qaIterations = 0;
                    }
                }

                if (currentState.status === 'completed') {
                    completionAttempts++;
                    if (completionAttempts >= 2) {
                        break;
                    }
                } else if (currentState.status === 'needs_clarification') {
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
    };


    const handleRunWorkflow = useCallback(async (overrides?: { goal?: string; maxIterations?: number }) => {
        const effectiveGoal = overrides?.goal ?? goal;
        const effectiveMaxIterations = overrides?.maxIterations ?? maxIterations;

        if (!effectiveGoal.trim()) {
            setError('Please enter a goal.');
            return;
        }
        setIsRunning(true);
        setError(null);
        
        if (overrides?.goal) setGoal(overrides.goal);
        if (overrides?.maxIterations) setMaxIterations(overrides.maxIterations);

        let initialState: WorkflowState = {
            goal: effectiveGoal,
            maxIterations: effectiveMaxIterations,
            currentIteration: 0,
            status: 'running',
            runLog: [],
            state: {
                goal: effectiveGoal,
                steps: [],
                artifacts: [...goalFileArtifacts, ...goalImageArtifacts],
                notes: 'Initial state. Planner needs to create steps.',
                progress: 'Processing',
            },
            finalResultMarkdown: '',
            finalResultSummary: '',
        };
        setWorkflowState(initialState);
        
        if (guidanceMode === 'auto') {
            await runWorkflowLoop(initialState);
        } else { // human-guided
            try {
                const newState = await runWorkflowIteration(initialState, settings);
                const plannerState = { ...newState, currentIteration: 1 };
                setWorkflowState(plannerState);

                if (plannerState.state.steps && plannerState.state.steps.length > 0) {
                    setIsAwaitingApproval(true);
                } else {
                    setError("The planner failed to generate a valid plan. Please try refining your goal and run again.");
                }
            } catch (err) {
                 console.error(err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred during the planning phase.');
                const finalState = {...initialState, status: 'error' as const, currentIteration: 1};
                setWorkflowState(finalState);
            } finally {
                setIsRunning(false);
            }
        }

    }, [goal, maxIterations, settings, guidanceMode]);

     const handlePlanApproval = () => {
        if (!workflowState) return;
        setIsAwaitingApproval(false);
        setIsRunning(true);
        runWorkflowLoop(workflowState, 2); 
    };

    const handlePlanRejection = () => {
        setIsAwaitingApproval(false);
    };

    const handleRunWorkflowFromStateFile = (file: File) => {
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

    const StepsProgress: React.FC<{ steps: string[]; progress: string; status: WorkflowState['status'] }> = ({ steps, progress, status }) => {
        if (!steps || steps.length === 0) return null;
        const match = progress?.match(/step (\d+)/i);
        const currentStep = status === 'completed' ? steps.length : (match ? parseInt(match[1], 10) : 1);
        const completed = Math.min(Math.max(currentStep - 1, 0), steps.length);
        return (
            <div className="mb-4 bg-card-bg border border-border-muted rounded-lg p-3 shadow">
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                    <span>Progress</span>
                    <span>{completed}/{steps.length} steps completed</span>
                </div>
                <div className="h-3 bg-black/40 rounded-full overflow-hidden border border-border-muted">
                    <div
                        className="h-full bg-primary-end transition-all"
                        style={{ width: `${(completed / steps.length) * 100}%` }}
                    />
                </div>
            </div>
        );
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6">
                <div className="text-center space-y-4 max-w-md w-full">
                    <h1 className="text-2xl font-bold text-white">Super Agentic Workflow System</h1>
                    <p className="text-text-muted text-sm">Please sign in to continue.</p>
                </div>
                {isAuthModalOpen && (
                    <AuthModal
                        onClose={() => setIsAuthModalOpen(true)} // keep modal open until authenticated
                        onAuthenticated={() => { setIsAuthenticated(true); setIsAuthModalOpen(false); }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8 flex flex-col">
            <div className="w-full max-w-7xl mx-auto flex-grow flex gap-8">
                {workflowState && workflowState.state.steps.length > 0 && workflowState.state.artifacts.some(a => a.key === 'Plan.md') && (
                    <PlanSidebar
                        steps={workflowState.state.steps}
                        progress={workflowState.state.progress || ''}
                        status={workflowState.status}
                    />
                )}
                <div className="flex-1 flex flex-col min-w-0">
                    <Header
                        isAuthenticated={isAuthenticated}
                        onLoginClick={() => setIsAuthModalOpen(true)}
                        onLogoutClick={() => setIsAuthenticated(false)}
                        onSettingsClick={() => setIsSettingsOpen(true)}
                        onHelpClick={() => setIsHelpModalOpen(true)}
                    />

                    {/* Service Status Banners */}
                    {(serviceStatus.backend === 'offline' || serviceStatus.ollama === 'offline' || serviceStatus.ldap === 'offline') && (
                        <div className="mt-4 space-y-2">
                            {serviceStatus.backend === 'offline' && (
                                <div className="bg-yellow-900/30 border border-yellow-600 text-yellow-200 p-3 rounded-lg">
                                    <p className="text-sm">⚠️ Backend service is not responding. Please restart the application.</p>
                                </div>
                            )}
                            {serviceStatus.ollama === 'offline' && (
                                <div className="bg-orange-900/30 border border-orange-600 text-orange-200 p-3 rounded-lg">
                                    <p className="text-sm">⚠️ Ollama service is not accessible. Ensure ollama serve and model loading on the external server.</p>
                                </div>
                            )}
                            {serviceStatus.ldap === 'offline' && (
                                <div className="bg-red-900/30 border border-red-600 text-red-200 p-3 rounded-lg">
                                    <p className="text-sm">⚠️ LDAP service is not running. Authentication may not work.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <main className="mt-8 flex-grow">
                        {workflowState && workflowState.state.steps.length > 0 && (
                            <StepsProgress
                                steps={workflowState.state.steps}
                                progress={workflowState.state.progress || ''}
                                status={workflowState.status}
                            />
                        )}
                        <div className="bg-card-bg border border-border-muted rounded-xl shadow-2xl p-6 backdrop-blur-lg">
                            <WorkflowInput
                                goal={goal}
                                setGoal={setGoal}
                                maxIterations={maxIterations}
                                setMaxIterations={setMaxIterations}
                                isRunning={isRunning}
                                isAuthenticated={isAuthenticated}
                                onRunWorkflow={() => handleRunWorkflow()}
                                onRunWorkflowFromStateFile={handleRunWorkflowFromStateFile}
                                onUploadGoalFile={(file) => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        const text = e.target?.result;
                                        if (typeof text === 'string') {
                                            setGoalFileArtifacts(prev => [...prev, { key: `goal_file_${file.name}`, value: text }]);
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                                onUploadGoalImage={(file) => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        const dataUrl = e.target?.result;
                                        if (typeof dataUrl === 'string') {
                                            setGoalImageArtifacts(prev => [...prev, { key: `goal_image_${file.name}`, value: dataUrl }]);
                                        }
                                    };
                                    reader.readAsDataURL(file);
                                }}
                                onLoginClick={() => setIsAuthModalOpen(true)}
                                guidanceMode={guidanceMode}
                                setGuidanceMode={setGuidanceMode}
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
                    <Footer />
                </div>
            </div>
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
            {isAwaitingApproval && workflowState && (
                <PlanApprovalModal
                    steps={workflowState.state.steps}
                    onApprove={handlePlanApproval}
                    onReject={handlePlanRejection}
                />
            )}
        </div>
    );
};

export default App;
