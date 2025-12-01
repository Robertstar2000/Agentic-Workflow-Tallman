import React, { useEffect, useRef } from 'react';
import { XIcon, DocumentArrowUpIcon } from './icons';
import { helpContent } from '../help_content';
import { migrationPlanContent } from '../migration_content';
import { jsPDF } from 'jspdf';

/**
 * Props for the HelpModal component.
 */
interface HelpModalProps {
    /** Callback function to close the modal. */
    onClose: () => void;
}

/**
 * A simple markdown-to-HTML converter for the help content.
 * @param {string} text - The markdown text to parse.
 * @returns {string} The parsed HTML string.
 */
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

/**
 * Generates and downloads a PDF from Markdown content.
 * @param {string} content - The markdown string to convert to PDF.
 * @param {string} filename - The name of the downloaded file.
 */
const downloadPdf = (content: string, filename: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    const lines = content.split('\n');

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
        } else if (line.startsWith('#### ')) {
             doc.setFont('helvetica', 'bold');
             doc.setFontSize(11);
             const text = doc.splitTextToSize(line.substring(5), maxLineWidth);
             doc.text(text, margin, y);
             y += (text.length * 5) + 2;
        } else if (line.trim() === '---') {
            doc.setLineWidth(0.5);
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, y, pageWidth - margin, y);
            y += 10;
        } else if (line.trim() === '') {
             y += 5; // Paragraph break
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            // Simple strip of markdown bold/code for cleaner PDF text
            const cleanLine = line.replace(/\*\*/g, '').replace(/`/g, '');
            const text = doc.splitTextToSize(cleanLine, maxLineWidth);
            doc.text(text, margin, y);
            y += text.length * 5 + 2;
        }
    });

    doc.save(filename);
};

/**
 * A modal that displays help and instruction content to the user.
 * The content is sourced from a markdown string and rendered as HTML.
 * @param {HelpModalProps} props - The component props.
 */
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

    const handleDownloadPlan = () => {
        downloadPdf(migrationPlanContent, 'MIGRATION_PLAN.pdf');
    };

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
                <div className="mt-4 pt-4 border-t border-border-muted flex-shrink-0 flex justify-center">
                     <button 
                        onClick={handleDownloadPlan}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary-end border border-border-muted rounded-lg hover:bg-white/5 hover:text-primary-start transition-colors"
                    >
                        <DocumentArrowUpIcon className="w-5 h-5" />
                        <span>Download Full-Stack Migration Plan (.pdf)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};