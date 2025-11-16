

import React, { useState } from 'react';
import type { WorkflowState, WorkflowStatus, Artifact } from '../types';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { CheckCircleIcon, ExclamationIcon, SpinnerIcon, XCircleIcon, DownloadIcon, MapIcon, CogIcon, DownloadAllIcon } from './icons';
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

    doc.save('README.pdf');
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
    type Tab = 'result' | 'support' | 'log' | 'json';
    const [activeTab, setActiveTab] = useState<Tab>('result');
    
    const handleDownloadResult = () => {
        if (!state.finalResultMarkdown) return;
        if (state.resultType === 'text') {
            downloadResultAsPdf(state.finalResultMarkdown);
        } else {
            downloadFile(state.finalResultMarkdown, 'README.md', 'text/markdown');
        }
    }

    const downloadButtonLabel = state.resultType === 'text' ? 'Download README.pdf' : 'Download README.md';

    const handleDownloadArtifact = (artifact: Artifact) => {
        let mimeType = 'text/plain;charset=utf-8';
        const extension = artifact.key.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'json':
                mimeType = 'application/json';
                break;
            case 'md':
                mimeType = 'text/markdown;charset=utf-8';
                break;
            case 'html':
                mimeType = 'text/html;charset=utf-8';
                break;
            case 'css':
                mimeType = 'text/css;charset=utf-8';
                break;
            case 'js':
                 case 'ts':
            case 'tsx':
                mimeType = 'application/javascript;charset=utf-8';
                break;
        }
        downloadFile(artifact.value, artifact.key, mimeType);
    };

    const allArtifacts = [...state.state.artifacts];
    const hasReadmeArtifact = state.state.artifacts.some(a => a.key.toLowerCase() === 'readme.md');

    // If there's a final result but no corresponding artifact, create one virtually for the list.
    // This makes the UI more robust against the LLM not perfectly following instructions.
    if (state.finalResultMarkdown && !hasReadmeArtifact) {
        allArtifacts.push({
            key: 'README.md',
            value: state.finalResultMarkdown,
        });
    }

    const supportArtifacts = allArtifacts.filter(
        artifact => !['rag_results'].includes(artifact.key)
    );


    const handleDownloadAllArtifacts = async () => {
        if (supportArtifacts.length === 0) return;
        
        const zip = new JSZip();
        supportArtifacts.forEach(artifact => {
            zip.file(artifact.key, artifact.value);
        });

        try {
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'workflow-artifacts.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to create zip file", error);
        }
    };
    
    // FIX: Replaced `JSX.Element` with `React.ReactElement` to resolve namespace error.
    const agentIcons: { [key in 'Planner' | 'Worker' | 'QA']: React.ReactElement } = {
        Planner: <MapIcon className="w-5 h-5 text-o-purple" />,
        Worker: <CogIcon className="w-5 h-5 text-i-cyan" />,
        QA: <CheckCircleIcon className="w-5 h-5 text-f-green" />,
    };
    
    const TabButton: React.FC<{ tab: Tab, label: string }> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-t border-l border-r ${
                activeTab === tab 
                ? 'bg-card-bg border-border-muted text-text-primary' 
                : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary'
            }`}
            style={{ marginBottom: '-1px' }}
            aria-selected={activeTab === tab}
            role="tab"
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <AgentStatusPanel state={state} />

            <ResultCard 
                title="User-facing summary"
                actions={<DownloadButton onDownload={() => downloadFile(state.finalResultSummary || state.state.notes, 'summary.txt', 'text/plain')} />}
            >
                <p className="text-sm font-mono whitespace-pre-wrap text-text-muted">
                    {state.finalResultSummary || state.state.notes || 'No summary available yet.'}
                </p>
            </ResultCard>

            <div>
                <div className="flex border-b border-border-muted" role="tablist">
                    <TabButton tab="result" label="Result" />
                    {supportArtifacts.length > 0 && (
                         <TabButton tab="support" label={`Support (${supportArtifacts.length})`} />
                    )}
                    <TabButton tab="log" label={`Run Log (${state.runLog.length})`} />
                    <TabButton tab="json" label="JSON State" />
                </div>
                
                <div className="bg-card-bg border border-t-0 border-border-muted rounded-b-xl p-4 min-h-[300px]" role="tabpanel">
                    {activeTab === 'result' && (
                        <div className="animate-fade-in space-y-3">
                             <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-text-secondary">Final Result</h3>
                                {(state.finalResultMarkdown || state.status === 'completed') && (
                                     <button onClick={handleDownloadResult} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-white/10 transition-colors border border-border-muted text-text-muted disabled:opacity-50" aria-label="Download result">
                                        <DownloadIcon className="w-5 h-5" />
                                        <span>{downloadButtonLabel}</span>
                                    </button>
                                )}
                            </div>
                            {state.finalResultMarkdown ? (
                                <div className="prose prose-invert prose-sm max-w-none text-text-secondary" dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(state.finalResultMarkdown) }} />
                            ) : (
                                <p className="text-text-muted text-sm pt-4">The final result will be displayed here once the workflow is completed.</p>
                            )}
                        </div>
                    )}
                     
                    {activeTab === 'support' && (
                        <div className="animate-fade-in space-y-3">
                             <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-text-secondary">Supporting Documents & Assets</h3>
                                <button 
                                    onClick={handleDownloadAllArtifacts} 
                                    disabled={supportArtifacts.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-white/10 transition-colors border border-border-muted text-text-muted disabled:opacity-50" 
                                    aria-label="Download all artifacts as zip"
                                >
                                    <DownloadAllIcon className="w-5 h-5" />
                                    <span>Download All (.zip)</span>
                                </button>
                            </div>
                            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                                {supportArtifacts.map((artifact, index) => (
                                    <div key={index} className="flex items-center justify-between gap-3 p-3 bg-black/20 rounded-lg">
                                        <p className="font-mono text-sm text-text-secondary break-all">{artifact.key}</p>
                                        <DownloadButton onDownload={() => handleDownloadArtifact(artifact)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'log' && (
                        <div className="animate-fade-in space-y-3">
                             <h3 className="text-lg font-semibold text-text-secondary">Execution Log</h3>
                            <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                                {state.runLog.length > 0 ? state.runLog.map((entry, index) => (
                                    <div key={index} className="flex items-start gap-3 p-2 bg-black/20 rounded-lg">
                                        <div className="flex-shrink-0 mt-1" aria-hidden="true">
                                            {agentIcons[entry.agent]}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm">
                                                <span className="text-text-secondary">{entry.agent}</span>
                                                <span className="text-text-muted font-normal"> (Iteration {entry.iteration})</span>
                                            </p>
                                            <p className="text-sm text-text-muted">{entry.summary}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-text-muted text-sm pt-4">The execution log will appear here as the workflow runs.</p>
                                )}
                            </div>
                        </div>
                    )}

                     {activeTab === 'json' && (
                        <div className="animate-fade-in space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-text-secondary">Full JSON State</h3>
                                <DownloadButton onDownload={() => downloadFile(JSON.stringify(state, null, 2), 'workflow-state.json', 'application/json')} />
                            </div>
                             <div className="max-h-96 overflow-y-auto bg-black/50 p-2 rounded-md">
                                <pre className="text-xs text-text-secondary whitespace-pre-wrap" aria-label="JSON state">
                                    <code>{JSON.stringify(state, null, 2)}</code>
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};