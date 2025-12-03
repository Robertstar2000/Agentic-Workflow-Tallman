

import React from 'react';
import { LightBulbIcon } from './icons';

/**
 * A simple component that displays a usage tip to the user.
 */
export const Tip: React.FC = () => {
    return (
        <>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
                <LightBulbIcon className="w-4 h-4 text-amber-300" />
                <span>Tip: Try a vague goal like "Improve our system's performance"...</span>
            </div>
            <div className="mt-2 p-3 border-2 border-yellow-500 bg-yellow-500/10 rounded-lg text-center">
                <p className="text-yellow-400 font-semibold">This process will take a while so be patient as it will do what you have asked however complex. Once you exit the application the contents will be cleared, so save whatever you need for future use.</p>
            </div>
        </>
    );
};