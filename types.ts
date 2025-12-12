
/**
 * Defines the settings for a specific LLM provider.
 */
export interface ProviderSettings {
    /** The API key for the provider, if required. */
    apiKey?: string;
    /** The specific model name to be used (e.g., 'gpt-4o', 'claude-3-opus-20240229'). */
    model: string;
    /** The base URL for the API endpoint. */
    baseURL?: string;
}

/**
 * Defines the overall LLM settings for the application, using Ollama only.
 */
export interface LLMSettings {
    /** The currently active LLM provider (always Ollama). */
    provider: 'ollama';
    /** Settings for the Ollama provider. */
    ollama: ProviderSettings;
}

/**
 * Represents a single entry in the workflow's execution log.
 */
export interface RunLogEntry {
    /** The iteration number when this log entry was created. */
    iteration: number;
    /** The agent that performed the action. */
    agent: 'Planner' | 'Worker' | 'QA';
    /** A brief summary of the action taken. */
    summary: string;
}

/**
 * Represents a piece of data created or modified during the workflow.
 */
export interface Artifact {
    /** A unique key identifying the artifact. */
    key: string;
    /** The content of the artifact. If it's a complex object or array, it should be a JSON string. */
    value: string;
}

/**
 * Represents the internal, mutable state of the workflow that agents modify.
 */
export interface InternalState {
    /** The user-defined goal of the workflow. */
    goal: string;
    /** The list of steps to be executed. The Planner can modify this list. */
    steps: string[];
    /** A record of the initial plan created by the Planner. This should not be modified after creation. */
    initialPlan?: string[];
    /** A collection of artifacts produced during the workflow. */
    artifacts: Artifact[];
    /** Notes and feedback from the QA agent for the Planner. */
    notes: string;
    /** A high-level summary of the current progress. */
    progress: string;
}

/**
 * Defines the possible statuses of the workflow execution.
 */
export type WorkflowStatus = 'running' | 'completed' | 'needs_clarification' | 'error';

/**
 * Represents the complete state of a workflow at any given time.
 * This entire object is passed between iterations.
 */
export interface WorkflowState {
    /** The original goal provided by the user. */
    goal: string;
    /** The maximum number of iterations allowed for the workflow. */
    maxIterations: number;
    /** The current iteration number. */
    currentIteration: number;
    /** The current status of the workflow. */
    status: WorkflowStatus;
    /** A log of actions taken by the agents in each iteration. */
    runLog: RunLogEntry[];
    /** The detailed internal state of the workflow. */
    state: InternalState;
    /** The final result of the workflow in Markdown format, generated upon completion. */
    finalResultMarkdown: string;
    /** A concise, user-facing summary of the final result. */
    finalResultSummary: string;
    /** The type of the final result, determined by the QA agent upon completion. */
    resultType?: 'code' | 'text';
}
