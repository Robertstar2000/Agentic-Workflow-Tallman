# AI Workflow System

### From Goal to Result, Autonomously.

AI Workflow System is an intelligent automation platform that leverages Large Language Models to execute complex, multi-step workflows from a single, natural language goal. The system interprets your intention, creates a strategic plan, and executes it step-by-step, adapting and self-correcting until the objective is achieved.

---

### ✨ Key Features

*   **🚀 Multi-Agent Architecture:** Utilizes a sophisticated Planner, Worker, and QA agent loop to strategize, execute, and validate tasks, ensuring robust and reliable outcomes.
*   **🧠 Multi-Provider LLM Support:** Seamlessly switch between different LLM providers, including Google Gemini, OpenAI, Anthropic Claude, Ollama, and any OpenRouter-compatible endpoint.
*   **🔐 Secure Credential Storage:** API keys are encrypted client-side using the Web Crypto API, ensuring they are never stored in plaintext in your browser's local storage.
*   **🔄 Iterative Self-Correction:** The system constantly reviews its progress against the original goal, refining its plan and correcting mistakes to stay on track during long-running tasks.
*   **📊 Detailed Results & Logs:** Get a clear, user-facing summary, a comprehensive Markdown report, and the full final JSON state for deep analysis. Download any artifact with a single click.
*   **💡 Contextual Memory:** To maintain focus on complex, long-term goals, the system periodically re-injects the original plan and objective into its context, preventing drift.

### 🚀 Getting Started

1.  **Configure your LLM:** Click the **Settings** (⚙️) icon. Select your preferred LLM provider, enter your credentials (API key, URL, etc.), and use the "Test Connection" button to verify your setup.
2.  **Describe your Goal:** In the main text area, write a clear description of what you want to achieve. The more specific you are, the better the result, but feel free to start with a vague idea and let the AI figure it out.
3.  **Run the Workflow:** Click the "Run Workflow" button and watch the system execute your plan in real-time.

### 🤖 How It Works

The system operates on a continuous loop of three distinct AI agents:

1.  **The Planner:** Analyzes the user's goal and the current state to create or refine a step-by-step plan. On the first run, it establishes an `initialPlan` which serves as a long-term reference point.
2.  **The Worker:** Executes the current step defined by the Planner. It performs the "work," such as generating code, writing text, or creating data, and saves its output as artifacts.
3.  **The QA Agent:** Compares the work done against the original goal. It either approves the work and marks the workflow as complete, or it provides detailed feedback for the Planner to use in the next iteration.

This cycle repeats, allowing the system to tackle complex problems that would be impossible in a single pass.

### 💡 Programmatic Usage (API)

While the system does not expose a traditional REST API, you can trigger workflows programmatically by crafting a JSON file and using the **"Run from File"** feature. This provides a powerful way to integrate the workflow system into other scripts or processes.

#### API Format

The input must be a JSON file containing at least a `goal`. You can optionally specify `maxIterations`.

```json
{
  "goal": "Your detailed objective, such as 'Create a React component that fetches and displays user data from a placeholder API'.",
  "maxIterations": 50
}
```

#### Example

Here is a complete example file, which you could save as `my-workflow.json`:

```json
{
  "goal": "Generate a Python script that analyzes a CSV file named 'sales_data.csv'. The script should calculate the total sales per product category and output a new CSV file named 'summary.csv'.",
  "maxIterations": 25
}
```

#### How to Use

1.  Create a `.json` file with the content structured as shown above.
2.  In the application, click the **"Run from File"** button.
3.  Select your JSON file. The workflow will start immediately using the goal and parameters you defined.
