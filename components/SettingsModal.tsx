
import React, { useEffect, useRef, useState } from 'react';
import type { LLMSettings, ProviderSettings } from '../types';
import { XIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon } from './icons';
import { testProviderConnection } from '../services/be-workflowService';
import type { TestResult } from '../utils/testRunner';

interface SettingsModalProps {
    settings: LLMSettings;
    setSettings: (settings: LLMSettings) => void;
    onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

/**
 * Props for the ProviderSettingsForm component.
 */
interface ProviderSettingsFormProps {
    /** The key of the provider being configured (always 'ollama'). */
    providerKey: 'ollama';
    /** The current settings for this provider. */
    settings: ProviderSettings;
    /** Callback to update the provider's settings. */
    onChange: (newProviderSettings: ProviderSettings) => void;
    /** Async callback to test the connection for this provider. */
    onTest: () => Promise<void>;
    /** The current status of the connection test. */
    testStatus: TestStatus;
}

/**
 * A form for configuring the settings of Ollama.
 * @param {ProviderSettingsFormProps} props - The component props.
 */
const ProviderSettingsForm: React.FC<ProviderSettingsFormProps> = ({ providerKey, settings, onChange, onTest, testStatus }) => {
    return (
        <div className="space-y-4 pt-4 border-t border-border-muted animate-fade-in">
            <div>
                <label htmlFor={`${providerKey}-baseURL`} className="block text-sm font-medium text-text-secondary mb-1">Endpoint URL</label>
                <input
                    type="text"
                    id={`${providerKey}-baseURL`}
                    value={settings.baseURL || ''}
                    onChange={(e) => onChange({ ...settings, baseURL: e.target.value })}
                    placeholder="http://10.10.20.24:11434"
                    className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                />
            </div>
            <div>
                <label htmlFor={`${providerKey}-model`} className="block text-sm font-medium text-text-secondary mb-1">Model Name</label>
                <input
                    type="text"
                    id={`${providerKey}-model`}
                    value={settings.model}
                    onChange={(e) => onChange({ ...settings, model: e.target.value })}
                    placeholder="e.g., llama3.3:latest"
                    className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                />
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={onTest}
                    disabled={testStatus === 'testing'}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border border-border-muted rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    {testStatus === 'testing' ? (
                        <>
                            <SpinnerIcon className="w-4 h-4 animate-spin" />
                            Testing...
                        </>
                    ) : "Test Connection"}
                </button>
                {testStatus === 'success' && <CheckCircleIcon className="w-6 h-6 text-success" />}
                {testStatus === 'error' && <XCircleIcon className="w-6 h-6 text-error" />}
            </div>
        </div>
    );
};

/**
 * A modal component for configuring Ollama settings.
 * Settings are automatically saved to local storage.
 * @param {SettingsModalProps} props - The component props.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, setSettings, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [testRunnerStatus, setTestRunnerStatus] = useState<'idle' | 'running' | 'finished'>('idle');
    const [testResults, setTestResults] = useState<TestResult[]>([]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const saveSettings = async () => {
            localStorage.setItem('ai-workflow-settings', JSON.stringify(settings));
        };

        saveSettings();
        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, settings]);

    const handleProviderSettingsChange = (newProviderSettings: ProviderSettings) => {
        setSettings({ ...settings, ollama: newProviderSettings });
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        try {
            await testProviderConnection(settings);
            setTestStatus('success');
        } catch (e) {
            setTestStatus('error');
        }
        setTimeout(() => setTestStatus('idle'), 3000);
    };

    const handleRunTests = async () => {
        setTestRunnerStatus('running');
        setTestResults([]);

        try {
            const { allTestSuites } = await import('../tests/index');
            const { runTests } = await import('../utils/testRunner');
            const results = await runTests(allTestSuites);
            setTestResults(results);
        } catch(e) {
             console.error("Failed to run tests:", e);
             setTestResults([{ suite: 'Test Runner', name: 'Initialization', passed: false, error: (e as Error).message }]);
        } finally {
            setTestRunnerStatus('finished');
        }
    };

    const passedCount = testResults.filter(r => r.passed).length;
    const failedCount = testResults.length - passedCount;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div ref={modalRef} className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-lg p-6 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Settings</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
                        <XIcon className="w-6 h-6 text-text-muted" />
                    </button>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Ollama Settings</h3>

                    <ProviderSettingsForm
                        providerKey="ollama"
                        settings={settings.ollama}
                        onChange={handleProviderSettingsChange}
                        onTest={handleTestConnection}
                        testStatus={testStatus}
                    />
                </div>

                <div className="mt-6 pt-6 border-t border-border-muted">
                    <h3 className="text-lg font-semibold">System Diagnostics</h3>
                    <p className="text-sm text-text-muted mt-1 mb-4">
                        Run unit and integration tests to verify system components are working correctly.
                    </p>
                    <button
                        onClick={handleRunTests}
                        disabled={testRunnerStatus === 'running'}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border border-border-muted rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        {testRunnerStatus === 'running' ? (
                            <>
                                <SpinnerIcon className="w-4 h-4 animate-spin" />
                                Running Tests...
                            </>
                        ) : "Run All Tests"}
                    </button>

                    {testRunnerStatus === 'finished' && (
                        <div className="mt-4 max-h-64 overflow-y-auto bg-black/30 p-3 rounded-md animate-fade-in">
                            <div className={`flex items-center gap-2 font-semibold mb-3 pb-2 border-b border-border-muted ${failedCount > 0 ? 'text-error' : 'text-success'}`}>
                                {failedCount > 0 ? <XCircleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                                <span>{passedCount} passed, {failedCount} failed</span>
                            </div>

                            {failedCount > 0 && (
                                <div className="space-y-2 text-sm">
                                    <h4 className="font-semibold text-text-secondary">Failures:</h4>
                                    <ul className="space-y-2">
                                        {testResults.filter(r => !r.passed).map((result, i) => (
                                            <li key={i} className="p-2 bg-red-900/40 rounded">
                                                <p className="font-semibold text-red-300">[{result.suite}] {result.name}</p>
                                                <pre className="text-xs text-red-200 whitespace-pre-wrap font-mono mt-1">
                                                    {result.error}
                                                </pre>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                             {failedCount === 0 && (
                                 <p className="text-sm text-success">All tests passed successfully!</p>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
