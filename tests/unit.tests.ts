import { describe, it, expect } from '../utils/testRunner';
import { encrypt, decrypt } from '../utils/crypto';
import { parseAndSanitizeMarkdown } from '../utils/markdown';

/**
 * Executes all unit tests for the application's utility functions.
 */
export const runUnitTests = () => {
    describe('Crypto Utilities', () => {
        it('should encrypt and decrypt a string successfully', async () => {
            const plaintext = 'my-secret-api-key';
            const encrypted = await encrypt(plaintext);
            const decrypted = await decrypt(encrypted);
            expect(encrypted).not.toBe(plaintext);
            expect(decrypted).toBe(plaintext);
        });

        it('should handle empty strings', async () => {
            const plaintext = '';
            const encrypted = await encrypt(plaintext);
            const decrypted = await decrypt(encrypted);
            expect(encrypted).toBe('');
            expect(decrypted).toBe('');
        });
    });
    
    describe('Markdown Parser', () => {
        it('should escape HTML tags to prevent XSS', () => {
            const input = '<script>alert("xss")</script>';
            const expected = '<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>';
            const result = parseAndSanitizeMarkdown(input);
            expect(result).toBe(expected);
        });

        it('should correctly parse headings', () => {
            const input = '# Title\n## Subtitle\n### Sub-subtitle';
            const expected = '<h1>Title</h1><h2>Subtitle</h2><h3>Sub-subtitle</h3>';
            const result = parseAndSanitizeMarkdown(input);
            expect(result).toBe(expected);
        });

        it('should correctly parse bold and code formatting', () => {
            const input = 'This is **bold** and this is `code`.';
            const expected = '<p>This is <strong>bold</strong> and this is <code class="bg-slate-700/50 px-1 py-0.5 rounded-sm font-mono text-sm">code</code>.</p>';
            const result = parseAndSanitizeMarkdown(input);
            expect(result).toBe(expected);
        });

         it('should handle mixed content and newlines', () => {
            const input = '# Hello\n\nThis is a paragraph with **bold** text.\nAnd a `code` snippet.';
            const expected = '<h1>Hello</h1><p>This is a paragraph with <strong>bold</strong> text.</p><p>And a <code class="bg-slate-700/50 px-1 py-0.5 rounded-sm font-mono text-sm">code</code> snippet.</p>';
            const result = parseAndSanitizeMarkdown(input);
            expect(result).toBe(expected);
        });
    });
};
