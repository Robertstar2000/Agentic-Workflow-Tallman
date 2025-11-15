/**
 * @fileoverview Utility for parsing and sanitizing markdown content.
 */

/**
 * Parses and sanitizes a markdown string to prevent XSS vulnerabilities.
 * It converts basic markdown (headings, bold, code) to HTML.
 * @param {string} text - The raw markdown text from an untrusted source (e.g., LLM).
 * @returns {string} A string of safe HTML.
 */
export const parseAndSanitizeMarkdown = (text: string): string => {
    if (!text) return '';

    const escapeHtml = (unsafe: string): string => {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const processInlineFormatting = (line: string): string => {
        // Apply formatting rules to an already HTML-escaped line
        return line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code class="bg-slate-700/50 px-1 py-0.5 rounded-sm font-mono text-sm">$1</code>');
    };

    const lines = text.split('\n');
    const htmlElements: string[] = [];
    
    for (const line of lines) {
        const escapedLine = escapeHtml(line);
        
        if (escapedLine.startsWith('# ')) {
            htmlElements.push(`<h1>${processInlineFormatting(escapedLine.substring(2))}</h1>`);
        } else if (escapedLine.startsWith('## ')) {
            htmlElements.push(`<h2>${processInlineFormatting(escapedLine.substring(3))}</h2>`);
        } else if (escapedLine.startsWith('### ')) {
            htmlElements.push(`<h3>${processInlineFormatting(escapedLine.substring(4))}</h3>`);
        } else if (escapedLine.trim() === '') {
             // Let CSS handle paragraph spacing, don't inject <br>
        } else {
            htmlElements.push(`<p>${processInlineFormatting(escapedLine)}</p>`);
        }
    }
    
    return htmlElements.join('');
};
