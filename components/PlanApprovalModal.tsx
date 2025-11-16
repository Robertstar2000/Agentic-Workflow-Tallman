import React from 'react';
import { XIcon, CheckCircleIcon, ArrowUturnLeftIcon } from './icons';

interface PlanApprovalModalProps {
    steps: string[];
    onApprove: () => void;
    onReject: () => void;
}

export const PlanApprovalModal: React.FC<PlanApprovalModalProps> = ({ steps, onApprove, onReject }) => {
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-2xl p-6 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Review Generated Plan</h2>
                    <button onClick={onReject} className="p-1 rounded-full hover:bg-white/10">
                        <XIcon className="w-6 h-6 text-text-muted" />
                    </button>
                </div>
                
                <p className="text-text-secondary mb-4">The AI has generated the following plan. Please review the steps below. You can either approve the plan to begin execution or go back to edit your goal.</p>

                <div className="max-h-64 overflow-y-auto bg-black/30 p-4 rounded-lg border border-border-muted mb-6 space-y-3">
                    {steps.map((step, index) => (
                        <div key={index} className="flex items-start">
                            <span className="text-primary-end font-bold mr-3">{index + 1}.</span>
                            <p className="text-text-secondary">{step}</p>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end items-center gap-4">
                     <button
                        onClick={onReject}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-text-secondary bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-full shadow-lg transition-colors duration-300"
                    >
                        <ArrowUturnLeftIcon className="w-5 h-5" />
                        <span>Go Back & Edit Goal</span>
                    </button>
                    <button
                        onClick={onApprove}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-white bg-gradient-to-r from-success to-green-600 rounded-full shadow-lg hover:shadow-green-500/40 transition-all duration-300"
                    >
                        <CheckCircleIcon className="w-5 h-5" />
                        <span>Approve & Continue</span>
                    </button>
                </div>
            </div>
        </div>
    );
};