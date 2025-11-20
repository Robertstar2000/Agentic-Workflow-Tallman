/// <reference types="vite/client" />

import React, { useState } from 'react';
import { XIcon, UserIcon, GoogleIcon, MicrosoftIcon, GithubIcon } from './icons';

interface AuthModalProps {
    onClose: () => void;
    onAuthenticated: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthenticated }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const endpoint = `${API_BASE_URL}${isLogin ? '/api/auth/login' : '/api/auth/register'}`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            localStorage.setItem('auth_token', data.token);
            onAuthenticated();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-md p-6 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">{isLogin ? 'Sign In' : 'Create Account'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
                        <XIcon className="w-6 h-6 text-text-muted" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-3 mb-6">
                    <button
                        disabled
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/30 border border-border-muted rounded-lg opacity-50 cursor-not-allowed"
                        title="OAuth not configured. See setup guide."
                    >
                        <GoogleIcon className="w-5 h-5" />
                        <span className="font-semibold">Sign in with Google</span>
                        <span className="text-xs text-text-muted ml-auto">(Coming Soon)</span>
                    </button>
                    <button
                        disabled
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/30 border border-border-muted rounded-lg opacity-50 cursor-not-allowed"
                        title="OAuth not configured. See setup guide."
                    >
                        <MicrosoftIcon className="w-5 h-5" />
                        <span className="font-semibold">Sign in with Microsoft</span>
                        <span className="text-xs text-text-muted ml-auto">(Coming Soon)</span>
                    </button>
                    <button
                        disabled
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/30 border border-border-muted rounded-lg opacity-50 cursor-not-allowed"
                        title="OAuth not configured. See setup guide."
                    >
                        <GithubIcon className="w-5 h-5" />
                        <span className="font-semibold">Sign in with GitHub</span>
                        <span className="text-xs text-text-muted ml-auto">(Coming Soon)</span>
                    </button>
                </div>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-border-muted"></div>
                    <span className="flex-shrink mx-4 text-text-muted text-sm">OR</span>
                    <div className="flex-grow border-t border-border-muted"></div>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">Email or Username</label>
                        <input
                            type="text"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com or username"
                            className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password-auth" className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                        <input
                            type="password"
                            id="password-auth"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-8 py-3 font-semibold text-white bg-gradient-to-r from-primary-start to-primary-end rounded-full shadow-lg hover:shadow-primary-end/40 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="animate-pulse">Processing...</span>
                        ) : (
                            <>
                                <UserIcon className="w-5 h-5" />
                                <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-text-muted hover:text-white transition-colors"
                    >
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
};