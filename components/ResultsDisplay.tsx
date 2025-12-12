
import React, { useState } from 'react';
import type { WorkflowState, WorkflowStatus, Artifact } from '../types';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { CheckCircleIcon, ExclamationIcon, SpinnerIcon, XCircleIcon, DownloadIcon, MapIcon, CogIcon, DownloadAllIcon, TerminalIcon, ClipboardListIcon, PlayIcon } from './icons';
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

const AgentIcon: React.FC<{ agent: 'Planner' | 'Worker' | 'QA' }> = ({ agent }) => {
    const icons = {
        Planner: (
            <div className="p-2 rounded-full bg-o-purple/10 border border-o-purple/20 flex items-center justify-center">
                <MapIcon className="w-4 h-4 text-o-purple" />
            </div>
        ),
        Worker: (
            <div className="p-2 rounded-full bg-i-cyan/10 border border-i-cyan/20 flex items-center justify-center">
                <TerminalIcon className="w-4 h-4 text-i-cyan" />
            </div>
        ),
        QA: (
            <div className="p-2 rounded-full bg-f-green/10 border border-f-green/20 flex items-center justify-center">
                <ClipboardListIcon className="w-4 h-4 text-f-green" />
            </div>
        ),
    };
    return icons[agent] || icons['Planner'];
};


const AgentStatusPanel: React.FC<{ state: WorkflowState }> = ({ state }) => {
    const lastLog = state.runLog.length > 0 ? state.runLog[state.runLog.length - 1] : null;
    const currentAgent = lastLog?.agent || 'Planner';
    const summary = lastLog?.summary || state.state.progress || 'Initializing...';
    const displayText = String(summary).substring(0, 80);
    const tools = summary.toLowerCase().includes('rag') ? 'RAG' :
        summary.toLowerCase().includes('internet') ? 'Internet' : '';

    return (
        <div className="bg-card-bg border border-border-muted rounded-xl p-3 backdrop-blur-lg">
            <div className="flex items-center gap-3 overflow-hidden">
                <AgentIcon agent={currentAgent} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary text-sm">{currentAgent}</span>
                        <StatusIndicator status={state.status} />
                        <span className="text-xs text-text-muted">Iter {state.currentIteration}/{state.maxIterations}</span>
                        {tools && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{tools}</span>}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs text-text-secondary truncate">{displayText}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AllStepsPanel: React.FC<{ steps: string[] }> = ({ steps }) => {
    if (steps.length === 0) return null;
    return (
        <div className="bg-card-bg border border-border-muted rounded-xl p-4 backdrop-blur-lg">
            <h3 className="text-sm font-semibold text-text-secondary mb-3">Generated Plan</h3>
            <ol className="space-y-2">
                {steps.map((step, i) => (
                    <li key={`all-step-${i}`} className="text-sm text-text-secondary flex gap-2">
                        <span className="font-bold text-primary-end">{i + 1}.</span>
                        <span>{typeof step === 'string' ? step : JSON.stringify(step)}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
};

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
    type Tab = 'result' | 'plan' | 'requirements' | 'support' | 'log' | 'json';
    const [activeTab, setActiveTab] = useState<Tab>('result');
    
    const resultArtifactFallback = state.state.artifacts.find(a => a.key?.toLowerCase().startsWith('result')) 
        || state.state.artifacts.find(a => a.key?.toLowerCase() === 'readme.md');
    const displayResult = state.finalResultMarkdown || resultArtifactFallback?.value || '';

    const handleDownloadResult = () => {
        if (!displayResult) return;
        if (state.resultType === 'text') {
            downloadResultAsPdf(displayResult);
        } else {
            downloadFile(displayResult, 'README.md', 'text/markdown');
        }
    }

    const downloadButtonLabel = 'Download the Final Report';

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
            case 'csv':
                mimeType = 'text/csv;charset=utf-8';
                break;
            case 'sql':
                mimeType = 'application/sql;charset=utf-8';
                break;
            case 'svg':
                mimeType = 'image/svg+xml;charset=utf-8';
                break;
            case 'xml':
                mimeType = 'application/xml;charset=utf-8';
                break;
        }
        downloadFile(artifact.value, artifact.key, mimeType);
    };

    const handlePreviewArtifact = (artifact: Artifact) => {
        const blob = new Blob([artifact.value], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    const allArtifacts = [...state.state.artifacts];
    const hasReadmeArtifact = state.state.artifacts.some(a => a.key && a.key.toLowerCase() === 'readme.md');

    // If there's a final result but no corresponding artifact, create one virtually for the list.
    // This makes the UI more robust against the LLM not perfectly following instructions.
    if (state.finalResultMarkdown && !hasReadmeArtifact) {
        allArtifacts.push({
            key: 'README.md',
            value: state.finalResultMarkdown,
        });
    }

    const supportArtifacts = allArtifacts.filter(
        artifact => artifact.key && !['rag_results'].includes(artifact.key)
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
    
    const TabButton: React.FC<{ tab: Tab, label: string }> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                    ? 'bg-white/10 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary hover:bg-white/5'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <AgentStatusPanel state={state} />

            <div className="flex gap-2 border-b border-border-muted pb-1 overflow-x-auto">
                <TabButton tab="result" label="Result" />
                <TabButton tab="plan" label="Plan" />
                <TabButton tab="requirements" label="Requirements" />
                <TabButton tab="support" label="Support Artifacts" />
                <TabButton tab="log" label="Run Log" />
                <TabButton tab="json" label="JSON State" />
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'result' && (
                    <ResultCard 
                        title="Final Result" 
                        actions={<button onClick={handleDownloadResult} className="flex items-center gap-2 text-sm text-primary-end hover:text-primary-start transition-colors"><DownloadIcon className="w-4 h-4" />{downloadButtonLabel}</button>}
                    >
                        {displayResult ? (
                            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(displayResult) }} />
                        ) : (
                             <div className="flex flex-col items-center justify-center h-64 text-text-muted">
                                <SpinnerIcon className="w-8 h-8 mb-4 animate-spin opacity-50" />
                                <p>Workflow in progress...</p>
                            </div>
                        )}
                        {state.finalResultSummary && (
                            <div className="mt-6 p-4 bg-white/5 rounded-lg border border-border-muted">
                                <h4 className="text-sm font-semibold text-text-primary mb-2">Summary</h4>
                                <p className="text-sm text-text-secondary">{state.finalResultSummary}</p>
                            </div>
                        )}
                    </ResultCard>
                )}

                {activeTab === 'plan' && (
                    <ResultCard 
                        title="Project Plan"
                        actions={state.state.artifacts.find(a => a.key === 'Plan.md') ? (
                            <button onClick={() => {
                                const plan = state.state.artifacts.find(a => a.key === 'Plan.md');
                                if (plan) downloadFile(plan.value, 'Plan.md', 'text/markdown');
                            }} className="flex items-center gap-2 text-sm text-primary-end hover:text-primary-start transition-colors">
                                <DownloadIcon className="w-4 h-4" /> Download Plan
                            </button>
                        ) : undefined}
                    >
                        {state.state.artifacts.find(a => a.key === 'Plan.md') ? (
                            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(state.state.artifacts.find(a => a.key === 'Plan.md')!.value) }} />
                        ) : (
                            <p className="text-text-muted text-center py-12">Plan not yet generated.</p>
                        )}
                    </ResultCard>
                )}

                {activeTab === 'requirements' && (
                    <ResultCard 
                        title="Requirements Specification"
                        actions={state.state.artifacts.find(a => a.key === 'Requirements.md') ? (
                            <button onClick={() => {
                                const req = state.state.artifacts.find(a => a.key === 'Requirements.md');
                                if (req) downloadFile(req.value, 'Requirements.md', 'text/markdown');
                            }} className="flex items-center gap-2 text-sm text-primary-end hover:text-primary-start transition-colors">
                                <DownloadIcon className="w-4 h-4" /> Download Requirements
                            </button>
                        ) : undefined}
                    >
                        {state.state.artifacts.find(a => a.key === 'Requirements.md') ? (
                            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(state.state.artifacts.find(a => a.key === 'Requirements.md')!.value) }} />
                        ) : (
                            <p className="text-text-muted text-center py-12">Requirements not yet generated.</p>
                        )}
                    </ResultCard>
                )}

                {activeTab === 'support' && (
                    <ResultCard 
                        title="Generated Artifacts"
                         actions={supportArtifacts.length > 0 ? (
                            <button onClick={handleDownloadAllArtifacts} className="flex items-center gap-2 text-sm text-primary-end hover:text-primary-start transition-colors">
                                <DownloadAllIcon className="w-4 h-4" /> Download All (.zip)
                            </button>
                        ) : undefined}
                    >
                         {supportArtifacts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {supportArtifacts.map((artifact, i) => (
                                    <div key={`artifact-${i}-${artifact.key}`} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-border-muted group hover:border-primary-start/50 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-slate-900 rounded-md">
                                                {/* Simple extension icon logic */}
                                                <span className="text-xs font-mono font-bold text-text-muted">
                                                    {artifact.key.split('.').pop()?.toUpperCase() || 'FILE'}
                                                </span>
                                            </div>
                                            <p className="font-medium text-sm text-text-primary truncate" title={artifact.key}>{artifact.key}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {artifact.key.toLowerCase() === 'index.html' && (
                                                 <button onClick={() => handlePreviewArtifact(artifact)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-primary-end" aria-label="Preview">
                                                    <PlayIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                            <DownloadButton onDownload={() => handleDownloadArtifact(artifact)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-text-muted text-center py-12">No artifacts generated yet.</p>
                        )}
                    </ResultCard>
                )}

                {activeTab === 'log' && (
                    <ResultCard title="Execution Log">
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                             {state.runLog && state.runLog.length > 0 ? (
                                [...state.runLog].reverse().map((entry, i) => {
                                    if (!entry || typeof entry !== 'object') return null;
                                    const timestamp = new Date().toLocaleTimeString();
                                    const agent = entry.agent || 'Planner';
                                    const iteration = entry.iteration || state.currentIteration || 0;
                                    const summary = String(entry.summary || entry.toString() || 'No summary available');
                                    const tools = summary.includes('rag_query') ? 'RAG' :
                                                 summary.includes('internet_query') ? 'Internet Search' :
                                                 summary.includes('added') ? 'Added Step' :
                                                 summary.includes('created') ? 'File Write' : '';
                                    return (
                                        <div key={`log-${i}-${iteration}-${agent}`} className="p-3 rounded-lg bg-white/5 border border-border-muted">
                                            <div className="flex items-center gap-3 mb-2">
                                                <AgentIcon agent={agent} />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-sm text-text-primary">{agent}</span>
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-start/20 text-primary-end whitespace-nowrap">Iter {iteration}</span>
                                                        {tools && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{tools}</span>}
                                                        <span className="text-xs text-text-muted">{timestamp}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-text-secondary ml-11">{summary}</p>
                                        </div>
                                    );
                                }).filter(Boolean)
                            ) : (
                                <div className="text-center text-text-muted py-12">
                                    <TerminalIcon className="w-12 h-12 mb-4 mx-auto opacity-50" />
                                    <p>No execution logs available yet.</p>
                                    <p className="text-sm text-text-muted mt-2">Run the workflow to see agent actions here.</p>
                                </div>
                            )}
                        </div>
                    </ResultCard>
                )}

                {activeTab === 'json' && (
                    <ResultCard 
                        title="Full State (JSON)"
                        actions={
                            <button 
                                onClick={() => downloadFile(JSON.stringify(state, null, 2), 'workflow-state.json', 'application/json')}
                                className="flex items-center gap-2 text-sm text-primary-end hover:text-primary-start transition-colors"
                            >
                                <DownloadIcon className="w-4 h-4" /> Download JSON
                            </button>
                        }
                    >
                        <div className="relative">
                             <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-xs font-mono text-green-400 border border-border-muted max-h-[600px]">
                                {JSON.stringify(state, null, 2)}
                            </pre>
                            <button 
                                onClick={() => {
                                     navigator.clipboard.writeText(JSON.stringify(state, null, 2));
                                }}
                                className="absolute top-2 right-2 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded text-text-secondary transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                    </ResultCard>
                )}
            </div>
        </div>
    );
};
