import React, { useState } from 'react';
import { XIcon, UserIcon } from './icons';
import { api } from '../services/api';

/**
 * Props for the AuthModal component.
 */
interface AuthModalProps {
    /** Callback function to close the modal. */
    onClose: () => void;
    /** Callback function to indicate the user has been authenticated. */
    onAuthenticated: () => void;
}

/**
 * A modal component for user authentication.
 * @param {AuthModalProps} props - The component props.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthenticated }) => {
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError('');
        setLoading(true);

        try {
            if (mode === 'signin') {
                const cleanedEmail = email.trim();
                const cleanedPass = password.trim();
                if (!cleanedEmail || !cleanedPass) {
                    setError('Email and password are required.');
                    setLoading(false);
                    return;
                }

                const response = await api.login(cleanedEmail, cleanedPass);
                if (response.error) {
                    setError(response.error);
                } else if (response.token) {
                    onAuthenticated();
                } else {
                    setError('Authentication failed. Please try again.');
                }
            } else {
                const cleanedUser = username.trim();
                const cleanedEmail = email.trim();
                const cleanedPass = password.trim();
                if (!cleanedUser || !cleanedEmail || !cleanedPass) {
                    setError('Username, email and password are required.');
                    setLoading(false);
                    return;
                }

                const response = await api.register(cleanedUser, cleanedEmail, cleanedPass);
                if (response.error) {
                    setError(response.error);
                } else if (response.token) {
                    onAuthenticated();
                } else {
                    setError('Registration failed. Please try again.');
                }
            }
        } catch (err) {
            setError('Authentication service temporarily unavailable');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-md p-6 backdrop-blur-lg">
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold text-white">Super Agentic Workflow</h1>
                </div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Authentication</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
                        <XIcon className="w-6 h-6 text-text-muted" />
                    </button>
                </div>

                {/* Tab buttons */}
                <div className="flex mb-6">
                    <button
                        onClick={() => setMode('signin')}
                        className={`flex-1 py-2 px-4 text-center rounded-l-lg ${mode === 'signin' ? 'bg-primary-start text-white' : 'bg-slate-700 text-text-secondary'}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setMode('signup')}
                        className={`flex-1 py-2 px-4 text-center rounded-r-lg ${mode === 'signup' ? 'bg-primary-start text-white' : 'bg-slate-700 text-text-secondary'}`}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {mode === 'signup' && (
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1">Username</label>
                            <input
                                type="text"
                                id="username"
                                placeholder="Display Name"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="email@tallmanequipment.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password-auth" className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                        <input
                            type="password"
                            id="password-auth"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                            required
                        />
                    </div>
                    {error && (
                        <p className="text-red-400 text-sm text-center">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-8 py-3 font-semibold text-white bg-gradient-to-r from-primary-start to-primary-end rounded-full shadow-lg hover:shadow-primary-end/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserIcon className="w-5 h-5" />
                        <span>{loading ? (mode === 'signin' ? 'Signing In...' : 'Signing Up...') : (mode === 'signin' ? 'Sign In' : 'Sign Up')}</span>
                    </button>
                </form>
            </div>
        </div>
    );
};
