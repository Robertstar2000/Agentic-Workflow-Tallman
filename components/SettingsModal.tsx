

import React, { useEffect, useRef, useState } from 'react';
import type { LLMSettings, ProviderSettings } from '../types';
import { XIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon } from './icons';
import { testProviderConnection } from '../services/be-workflowService';
import { encrypt } from '../utils/crypto';


interface SettingsModalProps {
    settings: LLMSettings;
    setSettings: (settings: LLMSettings) => void;
    onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const ProviderSettingsForm: React.FC<{
    providerKey: keyof Omit<LLMSettings, 'provider'>,
    settings: ProviderSettings,
    onChange: (newProviderSettings: ProviderSettings) => void,
    onTest: () => Promise<void>,
    testStatus: TestStatus,
}> = ({ providerKey, settings, onChange, onTest, testStatus }) => {
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, setSettings, onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [activeProvider, setActiveProvider] = useState<LLMSettings['provider']>(settings.provider);
    const [testStatus, setTestStatus] = useState<Record<LLMSettings['provider'], TestStatus>>({
        google: 'idle',
        openai: 'idle',
        claude: 'idle',
        openrouter: 'idle',
        ollama: 'idle'
    });

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

    const providers: LLMSettings['provider'][] = ['google', 'openai', 'claude', 'openrouter', 'ollama'];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div ref={modalRef} className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-lg p-6 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">LLM Provider Settings</h2>
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
            </div>
        </div>
    );
};