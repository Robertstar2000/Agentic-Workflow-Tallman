
import React, { useEffect, useRef, useState } from 'react';
import type { LLMSettings, ProviderSettings } from '../types';
import { XIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon } from './icons';
import { testProviderConnection } from '../services/be-workflowService';
import { encrypt } from '../utils/crypto';
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
    /** The key of the provider being configured (e.g., 'openai', 'claude'). */
    providerKey: keyof Omit<LLMSettings, 'provider'>;
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
 * A form for configuring the settings of a single LLM provider.
 * @param {ProviderSettingsFormProps} props - The component props.
 */
const ProviderSettingsForm: React.FC<ProviderSettingsFormProps> = ({ providerKey, settings, onChange, onTest, testStatus }) => {
    const hasApiKey = providerKey !== 'google' && providerKey !== 'ollama';
    const hasBaseURL = providerKey !== 'google';

    return (
        <div className="space-y-4 pt-4 border-t border-border-muted animate-fade-in">
            {hasBaseURL && (
                 <div>
                    <label htmlFor={`${providerKey}-baseURL`} className="block text-sm font-medium text-text-secondary mb-1">Endpoint URL</label>
                    <input
                        type="text"
                        id={`${providerKey}-baseURL`}
                        value={settings.baseURL || ''}
                        onChange={(e) => onChange({ ...settings, baseURL: e.target.value })}
                        placeholder={providerKey === 'ollama' ? "http://localhost:11434" : "https://api.example.com/v1"}
                        className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                    />
                </div>
            )}
            {hasApiKey && (
                 <div>
                    <label htmlFor={`${providerKey}-apiKey`} className="block text-sm font-medium text-text-secondary mb-1">API Key</label>
                    <input
                        type="password"
                        id={`${providerKey}-apiKey`}
                        value={settings.apiKey || ''}
                        onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                    />
                </div>
            )}
             <div>
                <label htmlFor={`${providerKey}-model`} className="block text-sm font-medium text-text-secondary mb-1">Model Name</label>
                <input
                    type="text"
                    id={`${providerKey}-model`}
                    value={settings.model}
                    onChange={(e) => onChange({ ...settings, model: e.target.value })}
                    placeholder="e.g., gemini-2.5-flash, gpt-4o"
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
 * A modal component for configuring LLM provider settings.
 * It allows switching between providers and updating their respective configurations.
 * Settings are automatically saved to local storage.
 * @param {SettingsModalProps} props - The component props.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, setSettings, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [activeProvider, setActiveProvider] = useState<LLMSettings['provider']>(settings.provider);
    const [testStatus, setTestStatus] = useState<Record<LLMSettings['provider'], TestStatus>>({
        google: 'idle',
        openai: 'idle',
        claude: 'idle',
        openrouter: 'idle',
        ollama: 'idle',
        groq: 'idle',
        samba: 'idle',
        cerberus: 'idle',
    });
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
            // Create a deep copy to avoid mutating state before encryption
            const settingsToSave = JSON.parse(JSON.stringify(settings));
            
            // Encrypt API keys before saving
            if (settingsToSave.openai.apiKey) {
                settingsToSave.openai.apiKey = await encrypt(settingsToSave.openai.apiKey);
            }
            if (settingsToSave.claude.apiKey) {
                settingsToSave.claude.apiKey = await encrypt(settingsToSave.claude.apiKey);
            }
             if (settingsToSave.openrouter.apiKey) {
                settingsToSave.openrouter.apiKey = await encrypt(settingsToSave.openrouter.apiKey);
            }
            if (settingsToSave.groq.apiKey) {
                settingsToSave.groq.apiKey = await encrypt(settingsToSave.groq.apiKey);
            }
            if (settingsToSave.samba.apiKey) {
                settingsToSave.samba.apiKey = await encrypt(settingsToSave.samba.apiKey);
            }
            if (settingsToSave.cerberus.apiKey) {
                settingsToSave.cerberus.apiKey = await encrypt(settingsToSave.cerberus.apiKey);
            }

            localStorage.setItem('ai-workflow-settings', JSON.stringify(settingsToSave));
        };
        
        saveSettings();
        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, settings]);

    const handleProviderChange = (provider: LLMSettings['provider']) => {
        setActiveProvider(provider);
        setSettings({ ...settings, provider });
    };

    const handleProviderSettingsChange = (provider: keyof Omit<LLMSettings, 'provider'>, newProviderSettings: ProviderSettings) => {
        setSettings({ ...settings, [provider]: newProviderSettings });
    };

    const handleTestConnection = async (provider: LLMSettings['provider']) => {
        setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));
        try {
            // Test with a temporary settings object reflecting the currently selected provider in UI
            await testProviderConnection({ ...settings, provider });
            setTestStatus(prev => ({ ...prev, [provider]: 'success' }));
        } catch (e) {
            setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
        }
        setTimeout(() => setTestStatus(prev => ({ ...prev, [provider]: 'idle' })), 3000);
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


    const providers: LLMSettings['provider'][] = ['google', 'openai', 'claude', 'openrouter', 'ollama', 'groq', 'samba', 'cerberus'];

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
                
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex flex-row md:flex-col md:border-r border-b md:border-b-0 border-border-muted pr-4 pb-4 md:pb-0 gap-1">
                        {providers.map(p => (
                            <button
                                key={p}
                                onClick={() => handleProviderChange(p)}
                                className={`w-full text-left p-2 rounded-md text-sm transition-colors ${activeProvider === p ? 'bg-primary-start/30 text-text-primary font-semibold' : 'hover:bg-white/5 text-text-muted'}`}
                            >
                                <span className="capitalize">{p}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1">
                        <h3 className="text-lg font-semibold capitalize mb-2">{activeProvider} Settings</h3>
                        {activeProvider === 'google' && <p className="text-sm text-text-muted">Uses the API key provided by the execution environment. No additional configuration needed.</p>}
                        
                        <ProviderSettingsForm
                            providerKey={activeProvider}
                            settings={settings[activeProvider]}
                            onChange={(newSettings) => handleProviderSettingsChange(activeProvider, newSettings)}
                            onTest={() => handleTestConnection(activeProvider)}
                            testStatus={testStatus[activeProvider]}
                        />
                    </div>
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
