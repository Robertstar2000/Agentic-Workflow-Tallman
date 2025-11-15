import React, { useRef } from 'react';
import { LockIcon, PlayIcon, SpinnerIcon, DocumentArrowUpIcon } from './icons';

interface WorkflowInputProps {
    goal: string;
    setGoal: (goal: string) => void;
    maxIterations: number;
    setMaxIterations: (iterations: number) => void;
    isRunning: boolean;
    isAuthenticated: boolean;
    onRunWorkflow: () => void;
    onRunWorkflowFromFile: (file: File) => void;
    onLoginClick: () => void;
}

export const WorkflowInput: React.FC<WorkflowInputProps> = ({
    goal,
    setGoal,
    maxIterations,
    setMaxIterations,
    isRunning,
    isAuthenticated,
    onRunWorkflow,
    onRunWorkflowFromFile,
    onLoginClick,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onRunWorkflowFromFile(file);
        }
        // Reset the input value to allow selecting the same file again
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
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isRunning}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-semibold text-text-secondary bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-full shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Run workflow from a JSON file"
                        >
                            <DocumentArrowUpIcon className="w-5 h-5" />
                            <span>Run from File</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};