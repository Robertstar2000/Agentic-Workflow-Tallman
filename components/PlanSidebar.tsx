import React from 'react';
import type { WorkflowStatus } from '../types';
import { CheckCircleIcon, CogIcon, CircleIcon } from './icons';

interface PlanSidebarProps {
    steps: string[];
    progress: string;
    status: WorkflowStatus;
}

type StepStatus = 'completed' | 'in-progress' | 'pending';

export const PlanSidebar: React.FC<PlanSidebarProps> = ({ steps, progress, status }) => {
    const match = progress ? progress.match(/step (\d+)/i) : null;
    const currentStepIndex = match ? parseInt(match[1], 10) - 1 : 0;
    
    const getStepStatus = (index: number): StepStatus => {
        if (status === 'completed') {
            return 'completed';
        }
        if (index < currentStepIndex) {
            return 'completed';
        }
        if (index === currentStepIndex) {
            return 'in-progress';
        }
        return 'pending';
    };
    
    const statusConfig: { [key in StepStatus]: { icon: React.ReactElement, textClass: string } } = {
        completed: {
            icon: <CheckCircleIcon className="w-6 h-6 text-success" />,
            textClass: 'text-text-muted line-through',
        },
        'in-progress': {
            icon: <CogIcon className="w-6 h-6 text-i-cyan animate-spin" />,
            textClass: 'text-text-primary font-semibold',
        },
        pending: {
            icon: <CircleIcon className="w-6 h-6 text-text-muted" />,
            textClass: 'text-text-secondary',
        },
    };

    return (
        <aside className="w-64 lg:w-80 flex-shrink-0 bg-card-bg border border-border-muted rounded-xl shadow-2xl p-4 backdrop-blur-lg self-start sticky top-8 animate-fade-in">
            <h2 className="text-lg font-semibold text-text-primary border-b border-border-muted pb-3 mb-3">Execution Plan</h2>
            <ul className="space-y-4">
                {steps.map((step, index) => {
                    const stepStatus = getStepStatus(index);
                    const { icon, textClass } = statusConfig[stepStatus];

                    return (
                        <li key={`step-${index}`} className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
                                {icon}
                            </div>
                            <p className={`text-sm ${textClass}`}>
                                <span className="font-bold">Step {index + 1}:</span> {
                                    typeof step === 'string' 
                                        ? step 
                                        : (step && typeof step === 'object' && 'description' in step)
                                            ? (step as { description: string }).description
                                            : JSON.stringify(step)
                                }
                            </p>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
};
