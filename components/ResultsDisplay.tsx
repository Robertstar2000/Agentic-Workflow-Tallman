import React, { useState } from 'react';
import type { WorkflowState, WorkflowStatus } from '../types';
import { jsPDF } from 'jspdf';
import { CheckCircleIcon, ExclamationIcon, SpinnerIcon, XCircleIcon, DownloadIcon } from './icons';
import { parseAndSanitizeMarkdown } from '../utils/markdown';

/**
 * Triggers a file download in the browser.
 * @param {string} content - The content of the file.
 * @param {string} fileName - The desired name for the downloaded file.
 * @param {string} mimeType - The MIME type of the file.
 */
const downloadFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


/**
 * Generates and downloads a PDF from Markdown content.
 * Note: This is a simplified implementation for demonstration purposes.
 * @param {string} markdownContent - The markdown string to convert to PDF.
 */
const downloadResultAsPdf = (markdownContent: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    const lines = markdownContent.split('\n');

    lines.forEach(line => {
        if (y > 280) { // Add new page if content overflows
            doc.addPage();
            y = 20;
        }

        if (line.startsWith('# ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            const text = doc.splitTextToSize(line.substring(2), maxLineWidth);
            doc.text(text, margin, y);
            y += (text.length * 8) + 4;
        } else if (line.startsWith('## ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            const text = doc.splitTextToSize(line.substring(3), maxLineWidth);
            doc.text(text, margin, y);
            y += (text.length * 6) + 3;
        } else if (line.startsWith('### ')) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            const text = doc.splitTextToSize(line.substring(4), maxLineWidth);
            doc.text(text, margin, y);
            y += (text.length * 5) + 2;
        } else if (line.trim() === '') {
             y += 5; // Paragraph break
        }
        else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            const text = doc.splitTextToSize(line, maxLineWidth);
            doc.text(text, margin, y);
            y += text.length * 7;
        }
    });

    doc.save('ai-workflow-result.pdf');
};

const StatusIndicator: React.FC<{ status: WorkflowStatus }> = ({ status }) => {
    const statusConfig = {
        running: {
            icon: <SpinnerIcon className="w-5 h-5 animate-spin text-blue-400" />,
            text: 'Running',
            color: 'text-blue-400',
            bgColor: 'bg-blue-900/50',
        },
        completed: {
            icon: <CheckCircleIcon className="w-5 h-5 text-success" />,
            text: 'Completed',
            color: 'text-success',
            bgColor: 'bg-green-900/50',
        },
        needs_clarification: {
            icon: <ExclamationIcon className="w-5 h-5 text-warning" />,
            text: 'Needs Clarification',
            color: 'text-warning',
            bgColor: 'bg-amber-900/50',
        },
        error: {
            icon: <XCircleIcon className="w-5 h-5 text-error" />,
            text: 'Error',
            color: 'text-error',
            bgColor: 'bg-red-900/50',
        },
    };

    const config = statusConfig[status];

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
            {config.icon}
            <span>{config.text}</span>
        </div>
    );
};


const AgentStatusPanel: React.FC<{ state: WorkflowState }> = ({ state }) => (
    <div className="bg-card-bg border border-border-muted rounded-xl p-4 flex flex-wrap gap-4 justify-between items-center backdrop-blur-lg">
        <div>
            <p className="text-sm text-text-muted">Agent</p>
            <p className="font-semibold text-text-primary">Workflow Agent</p>
        </div>
        <div>
            <p className="text-sm text-text-muted">Status</p>
            <StatusIndicator status={state.status} />
        </div>
        <div>
            <p className="text-sm text-text-muted">Iteration</p>
            <p className="font-semibold text-text-primary">{state.currentIteration} / {state.maxIterations}</p>
        </div>
         <div className="w-full bg-slate-800 rounded-full h-2.5 mt-2">
            <div className="bg-gradient-to-r from-primary-start to-primary-end h-2.5 rounded-full" style={{ width: `${(state.currentIteration / state.maxIterations) * 100}%` }}></div>
        </div>
    </div>
);

const ResultCard: React.FC<{ title: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }> = ({ title, children, className = '', actions }) => (
    <div className={`bg-card-bg border border-border-muted rounded-xl p-4 backdrop-blur-lg shadow-lg ${className}`}>
        <div className="flex justify-between items-center border-b border-border-muted pb-2 mb-3">
            <h3 className="text-lg font-semibold text-text-secondary">{title}</h3>
            {actions && <div>{actions}</div>}
        </div>
        {children}
    </div>
);

const DownloadButton: React.FC<{ onDownload: () => void; }> = ({ onDownload }) => (
    <button onClick={onDownload} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" aria-label="Download">
        <DownloadIcon className="w-5 h-5 text-text-muted" />
    </button>
);

/**
 * Displays the results of a workflow execution, including status, summaries, logs, and final outputs.
 * @param {object} props - The component props.
 * @param {WorkflowState} props.state - The current state of the workflow to display.
 */
export const ResultsDisplay: React.FC<{ state: WorkflowState }> = ({ state }) => {
    const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
    
    const handleDownloadResult = (format: 'pdf' | 'md') => {
        if (format === 'pdf') {
            downloadResultAsPdf(state.finalResultMarkdown);
        } else {
            downloadFile(state.finalResultMarkdown, 'ai-workflow-result.md', 'text/markdown');
        }
        setIsFormatDropdownOpen(false);
    }
    
    return (
        <div className="space-y-6 animate-fade-in">
            <AgentStatusPanel state={state} />

            {(state.finalResultMarkdown || state.status === 'completed') && (
                <ResultCard 
                    title="Result"
                    actions={
                        <div className="relative">
                            <button onClick={() => setIsFormatDropdownOpen(prev => !prev)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1" aria-label="Download result">
                                <DownloadIcon className="w-5 h-5 text-text-muted" />
                            </button>
                            {isFormatDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-32 bg-slate-800 border border-border-muted rounded-md shadow-lg z-10">
                                    <a onClick={() => handleDownloadResult('pdf')} className="block px-4 py-2 text-sm text-text-secondary hover:bg-primary-start/20 cursor-pointer">Download as .pdf</a>
                                    <a onClick={() => handleDownloadResult('md')} className="block px-4 py-2 text-sm text-text-secondary hover:bg-primary-start/20 cursor-pointer">Download as .md</a>
                                </div>
                            )}
                        </div>
                    }
                >
                    <div className="prose prose-invert prose-sm max-w-none text-text-secondary" dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(state.finalResultMarkdown) }} />
                </ResultCard>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <ResultCard 
                    title="User-facing summary" 
                    className="md:col-span-1"
                    actions={<DownloadButton onDownload={() => downloadFile(state.finalResultSummary || state.state.notes, 'summary.txt', 'text/plain')} />}
                >
                    <p className="text-sm font-mono whitespace-pre-wrap text-text-muted">
                        {state.finalResultSummary || state.state.notes || 'No summary available yet.'}
                    </p>
                </ResultCard>

                <ResultCard 
                    title="JSON Payload" 
                    className="md:col-span-1"
                    actions={<DownloadButton onDownload={() => downloadFile(JSON.stringify(state, null, 2), 'workflow-state.json', 'application/json')} />}
                >
                     <div className="max-h-64 overflow-y-auto bg-black/50 p-2 rounded-md">
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap">
                            <code>{JSON.stringify(state, null, 2)}</code>
                        </pre>
                    </div>
                </ResultCard>
            </div>
        </div>
    );
};