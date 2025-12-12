import React, { useRef } from 'react';
import { LockIcon, PlayIcon, SpinnerIcon, DocumentArrowUpIcon } from './icons';

/**
 * Props for the WorkflowInput component.
 */
interface WorkflowInputProps {
    /** The current goal description for the workflow. */
    goal: string;
    /** Callback to update the goal description. */
    setGoal: (goal: string) => void;
    /** The maximum number of iterations for the workflow. */
    maxIterations: number;
    /** Callback to update the maximum number of iterations. */
    setMaxIterations: (iterations: number) => void;
    /** Flag indicating if the workflow is currently running. */
    isRunning: boolean;
    /** Flag indicating if the user is authenticated. */
    isAuthenticated: boolean;
    /** Callback to start the workflow with the current goal. */
    onRunWorkflow: () => void;
    /** Callback to start a workflow from a JSON state file. */
    onRunWorkflowFromStateFile: (file: File) => void;
    /** Callback to upload a goal-related file (text/JSON/etc). */
    onUploadGoalFile: (file: File) => void;
    /** Callback to upload a goal-related image. */
    onUploadGoalImage: (file: File) => void;
    /** Flag indicating if a RAG content file has been provided. */
    ragContentProvided: boolean;
    /** Callback to open the login modal. */
    onLoginClick: () => void;
    /** The current guidance mode ('auto' or 'human'). */
    guidanceMode: 'auto' | 'human';
    /** Callback to set the guidance mode. */
    setGuidanceMode: (mode: 'auto' | 'human') => void;
}

/**
 * A component for inputting the workflow goal and parameters.
 * It provides controls to start the workflow, load a state from a file, and upload knowledge documents.
 * @param {WorkflowInputProps} props - The component props.
 */
export const WorkflowInput: React.FC<WorkflowInputProps> = ({
    goal,
    setGoal,
    maxIterations,
    setMaxIterations,
    isRunning,
    isAuthenticated,
    onRunWorkflow,
    onRunWorkflowFromStateFile,
    onLoginClick,
    guidanceMode,
    setGuidanceMode,
    onUploadGoalFile,
    onUploadGoalImage,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const goalFileInputRef = useRef<HTMLInputElement>(null);
    const goalImageInputRef = useRef<HTMLInputElement>(null);

    const handleStateFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onRunWorkflowFromStateFile(file);
        }
        e.target.value = '';
    };
    
    const handleGoalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUploadGoalFile(file);
        }
        e.target.value = '';
    };

    const handleGoalImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUploadGoalImage(file);
        }
        e.target.value = '';
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <label htmlFor="goal" className="block text-sm font-medium text-text-secondary mb-1">Goal</label>
                    <textarea
                        id="goal"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="Describe what you want to achieve..."
                        className="w-full min-h-[120px] p-3 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start transition-shadow"
                        disabled={isRunning}
                    />
                </div>
                 <div className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="iterations" className="block text-sm font-medium text-text-secondary mb-1">Max iterations</label>
                        <input
                            type="number"
                            id="iterations"
                            value={maxIterations}
                            onChange={(e) => setMaxIterations(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))}
                            min="1"
                            max="200"
                            className="w-full p-3 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start transition-shadow"
                            disabled={isRunning}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Mode</label>
                        <div className="flex items-center bg-slate-900/70 border border-border-muted rounded-lg p-1">
                            <button 
                                onClick={() => setGuidanceMode('auto')}
                                disabled={isRunning}
                                className={`flex-1 text-center text-sm py-1.5 rounded-md transition-colors ${guidanceMode === 'auto' ? 'bg-primary-start/80 text-white font-semibold' : 'text-text-muted hover:bg-white/5'}`}
                            >
                                Auto
                            </button>
                            <button 
                                onClick={() => setGuidanceMode('human')}
                                disabled={isRunning}
                                className={`flex-1 text-center text-sm py-1.5 rounded-md transition-colors ${guidanceMode === 'human' ? 'bg-primary-start/80 text-white font-semibold' : 'text-text-muted hover:bg-white/5'}`}
                            >
                                Human Guided
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-center items-center gap-4 flex-wrap">
                {isAuthenticated ? (
                    <button
                        onClick={onRunWorkflow}
                        disabled={isRunning || !goal.trim()}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 font-semibold text-white bg-gradient-to-r from-primary-start to-primary-end rounded-full shadow-lg hover:shadow-primary-end/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                    >
                        {isRunning ? (
                            <>
                                <SpinnerIcon className="w-5 h-5 animate-spin" />
                                <span>Running...</span>
                            </>
                        ) : (
                             <>
                                <PlayIcon className="w-5 h-5" />
                                <span>Run workflow</span>
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={onLoginClick}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 font-semibold text-white bg-gray-600 rounded-full shadow-lg hover:bg-gray-500 transition-colors"
                    >
                        <LockIcon className="w-5 h-5" />
                        <span>Log in to Run Workflow</span>
                    </button>
                )}
                 {isAuthenticated && (
                    <>
                        <input type="file" ref={fileInputRef} onChange={handleStateFileSelect} accept=".json" className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isRunning}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-text-secondary bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-full shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Run workflow from a JSON file"
                        >
                            <DocumentArrowUpIcon className="w-5 h-5" />
                            <span>Run from File</span>
                        </button>
                        <input type="file" ref={goalFileInputRef} onChange={handleGoalFileSelect} accept=".txt,.md,.json,.csv,.pdf" className="hidden" />
                        <button
                            onClick={() => goalFileInputRef.current?.click()}
                            disabled={isRunning}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-text-secondary bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-full shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Attach a goal file"
                        >
                            <DocumentArrowUpIcon className="w-5 h-5" />
                            <span>Attach Goal File</span>
                        </button>
                        <input type="file" ref={goalImageInputRef} onChange={handleGoalImageSelect} accept="image/*" className="hidden" />
                        <button
                            onClick={() => goalImageInputRef.current?.click()}
                            disabled={isRunning}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-text-secondary bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-full shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Attach a goal image"
                        >
                            <DocumentArrowUpIcon className="w-5 h-5" />
                            <span>Attach Goal Image</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
