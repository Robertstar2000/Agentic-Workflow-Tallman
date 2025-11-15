import React, { useEffect, useRef } from 'react';
import { XIcon } from './icons';
import { helpContent } from '../help_content';

interface HelpModalProps {
    onClose: () => void;
}

// A more robust markdown-to-HTML converter
const parseMarkdown = (text: string): string => {
    const lines = text.split('\n');
    const htmlElements: string[] = [];
    let listItems: string[] = [];

    const flushList = () => {
        if (listItems.length > 0) {
            htmlElements.push(`<ul>${listItems.join('')}</ul>`);
            listItems = [];
        }
    };

    for (const line of lines) {
        // Process inline styles first
        let processedLine = line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 px-1 py-0.5 rounded-sm font-mono text-sm">$1</code>');

        if (processedLine.startsWith('### ')) {
            flushList();
            htmlElements.push(`<h3>${processedLine.substring(4)}</h3>`);
        } else if (processedLine.startsWith('#### ')) {
            flushList();
            htmlElements.push(`<h4>${processedLine.substring(5)}</h4>`);
        } else if (processedLine.trim() === '---') {
            flushList();
            htmlElements.push('<hr class="border-border-muted my-4" />');
        } else if (processedLine.startsWith('*   ')) {
            listItems.push(`<li class="list-disc ml-5 my-1">${processedLine.substring(4)}</li>`);
        } else {
            flushList();
            if (processedLine.trim() !== '') {
                htmlElements.push(`<p class="text-text-secondary leading-relaxed">${processedLine}</p>`);
            }
        }
    }

    flushList(); // Flush any remaining list items at the end of the document
    
    return htmlElements.join('');
};


export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div ref={modalRef} className="bg-card-bg border border-border-muted rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col p-6 backdrop-blur-lg">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-xl font-semibold">Help & Instructions</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
                        <XIcon className="w-6 h-6 text-text-muted" />
                    </button>
                </div>
                <div className="prose prose-invert max-w-none flex-grow overflow-y-auto pr-2 space-y-4">
                    <div dangerouslySetInnerHTML={{ __html: parseMarkdown(helpContent) }} />
                </div>
            </div>
        </div>
    );
};