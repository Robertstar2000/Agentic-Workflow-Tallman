import React from 'react';
import { XIcon, GoogleIcon, MicrosoftIcon, GithubIcon, UserIcon } from './icons';

/**
 * Props for the AuthModal component.
 */
interface AuthModalProps {
    /** Callback function to close the modal. */
    onClose: () => void;
    /** Callback function to indicate the user has been "authenticated". */
    onAuthenticated: () => void;
}

/**
 * A modal component for displaying a simulated authentication flow.
 * In a real application, this would handle OAuth2 flows and user credentials.
 * @param {AuthModalProps} props - The component props.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthenticated }) => {
    // NOTE: This is a simulated authentication flow.
    // In a real application, these buttons would trigger a full OAuth2 flow
    // with a backend server to handle callbacks and issue tokens.
    const handleAuth = () => {
        onAuthenticated();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-md p-6 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Authentication Required</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
                        <XIcon className="w-6 h-6 text-text-muted" />
                    </button>
                </div>

                <div className="space-y-3">
                     <button onClick={handleAuth} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-lg transition-colors">
                        <GoogleIcon className="w-5 h-5" />
                        <span className="font-semibold">Sign in with Google</span>
                    </button>
                    <button onClick={handleAuth} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-lg transition-colors">
                        <MicrosoftIcon className="w-5 h-5" />
                        <span className="font-semibold">Sign in with Microsoft</span>
                    </button>
                    <button onClick={handleAuth} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-800/60 hover:bg-slate-700/80 border border-border-muted rounded-lg transition-colors">
                        <GithubIcon className="w-5 h-5" />
                        <span className="font-semibold">Sign in with GitHub</span>
                    </button>
                </div>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-border-muted"></div>
                    <span className="flex-shrink mx-4 text-text-muted text-sm">OR</span>
                    <div className="flex-grow border-t border-border-muted"></div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">Email Address</label>
                        <input type="email" id="email" placeholder="user@example.com" className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start" />
                    </div>
                     <div>
                        <label htmlFor="password-auth" className="block text-sm font-medium text-text-secondary mb-1">Password</label>
                        <input type="password" id="password-auth" placeholder="••••••••" className="w-full p-2 bg-slate-900/70 border border-border-muted rounded-lg focus:ring-2 focus:ring-primary-start" />
                    </div>
                    <button type="submit" className="w-full flex items-center justify-center gap-2 px-8 py-3 font-semibold text-white bg-gradient-to-r from-primary-start to-primary-end rounded-full shadow-lg hover:shadow-primary-end/40 transition-all duration-300 transform hover:scale-105">
                        <UserIcon className="w-5 h-5" />
                        <span>Sign In</span>
                    </button>
                </form>
                 <p className="text-xs text-center text-text-muted mt-4">
                    This is a simulated login. Any action will grant access.
                </p>
            </div>
        </div>
    );
};