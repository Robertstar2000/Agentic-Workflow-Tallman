/// <reference types="vite/client" />

import type { LLMSettings, WorkflowState } from "../types";

// Use environment variable for API URL in production, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_URL = `${API_BASE_URL}/api/workflow`;

const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

/**
 * Executes a single iteration of the workflow using the backend API.
 * @param {WorkflowState} currentState - The state of the workflow before the iteration.
 * @param {LLMSettings} settings - The configured LLM provider settings.
 * @param {string} [ragContent] - Optional knowledge content for the RAG system.
 * @returns {Promise<WorkflowState>} The workflow state after the iteration.
 */
export const runWorkflowIteration = async (currentState: WorkflowState, settings: LLMSettings, ragContent?: string): Promise<WorkflowState> => {
    try {
        const response = await fetch(`${API_URL}/run`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ currentState, settings, ragContent })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Workflow execution failed: ${errorText}`);
        }

        return await response.json();
    } catch (error: any) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error(`Could not connect to backend at ${API_URL}. Please ensure the server is running and accessible.`);
        }
        throw error;
    }
};

/**
 * Tests the connection to the currently configured LLM provider via the backend.
 * @param {LLMSettings} settings - The LLM settings to test.
 * @returns {Promise<boolean>} A promise that resolves to true if the connection is successful.
 */
export const testProviderConnection = async (settings: LLMSettings): Promise<boolean> => {
    try {
        const response = await fetch(`${API_URL}/test-connection`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Connection test failed: ${errorText}`);
        }

        const data = await response.json();
        return data.success;
    } catch (error: any) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error(`Could not connect to backend at ${API_URL}. Please ensure the server is running and accessible.`);
        }
        throw error;
    }
};
