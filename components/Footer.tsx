import React from 'react';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full text-center py-6 mt-8">
            <p className="text-sm text-text-muted">
                Made by{' '}
                <span className="font-bold tracking-wider">
                    <span className="text-m-pink">M</span>
                    <span className="text-i-cyan">I</span>
                    <span className="text-f-green">F</span>
                    <span className="text-e-yellow">E</span>
                    <span className="text-c-orange">C</span>
                    <span className="text-o-purple">O</span>
                </span>{' '}
                @2025
            </p>
        </footer>
    );
};
