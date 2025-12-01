# Migration Plan: Super Agentic Workflow System (SAWS) to Full-Stack

## Executive Summary
This document outlines the roadmap to migrate the current client-side prototype into a production-ready, full-stack application hosted on Microsoft Server. The target architecture utilizes a Node.js backend, a persistent SQL database, and a self-hosted Ollama instance running the Meta Llama 3.2 model.

---

## 1. Target Architecture

*   **OS:** Windows Server (2019/2022)
*   **Frontend:** React (Existing, refactored to remove mocks) served via IIS or Nginx for Windows.
*   **Backend:** Node.js + Express (TypeScript).
*   **Database:** SQLite (for simplicity and portability) or MS SQL Server.
*   **AI Engine:** Ollama running Llama 3.2 (Service mode).
*   **Process Management:** PM2 for Windows.

---

## 2. Phase 1: Environment Setup (MS Server)

### 2.1 Install Dependencies
1.  **Node.js (LTS):** Install the latest LTS version of Node.js for Windows.
2.  **Ollama:** Download and install Ollama for Windows.
    *   Run command: `ollama pull llama3.2`
    *   Ensure Ollama is running on `localhost:11434`.
3.  **PM2:** Install globally: `npm install -g pm2` | `npm install -g pm2-windows-startup`.

---

## 3. Phase 2: Backend Development

We need to replace the simulated `be-workflowService.ts` with a real API.

### AI IDE Prompt: Scaffold Backend
> **Prompt:** "Create a new directory `server` in the root. Initialize a TypeScript Node.js Express project. Install `express`, `cors`, `dotenv`, `sqlite3`, and `typeorm` (or `sequelize`). Create a basic `server.ts` that listens on port 3001 and has a health check endpoint `/api/health`."

### AI IDE Prompt: Database & Auth
> **Prompt:** "In the `server` directory, set up an SQLite database. Create two entities: `User` (id, username, password_hash) and `Workflow` (id, user_id, goal, state_json, status, created_at). Implement JWT-based authentication routes: `POST /api/auth/login` and `POST /api/auth/register`. *Important: Do not use mock data, implement real hashing with bcrypt.*"

### AI IDE Prompt: Workflow API
> **Prompt:** "Create API routes for workflows: `GET /api/workflows` (list user's workflows), `POST /api/workflows` (create new), `GET /api/workflows/:id` (get state), and `PUT /api/workflows/:id` (update state). Ensure these routes are protected by the JWT middleware."

### AI IDE Prompt: Ollama Proxy
> **Prompt:** "Create a service in the backend to communicate with the local Ollama instance running Llama 3.2. Implement an endpoint `POST /api/ai/generate` that accepts a prompt and configuration, proxies the request to `http://localhost:11434/api/generate` (or `/api/chat`), and returns the response. Handle timeouts and connection errors gracefully."

---

## 4. Phase 3: Frontend Refactoring

### AI IDE Prompt: API Client
> **Prompt:** "Create a new file `services/api.ts`. Implement functions to call the backend endpoints created in Phase 2 (Auth, Workflows, AI). Use `axios` or `fetch`. The client should automatically attach the JWT token from localStorage to requests."

### AI IDE Prompt: Remove Mocks & Integrate
> **Prompt:** "Refactor `App.tsx` and `be-workflowService.ts`.
> 1. Remove all mock data and simulated delays.
> 2. Replace the `AuthModal` logic to call `api.login` instead of the simulated login.
> 3. Update `runWorkflowIteration` to call `POST /api/ai/generate` instead of calling Ollama/OpenAI directly from the browser. This secures the workflow and prevents CORS issues."

### AI IDE Prompt: Workflow Persistence
> **Prompt:** "Update the Frontend to load previous workflows from `GET /api/workflows` instead of starting fresh every time. Add a 'History' sidebar to the UI to select past runs."

---

## 5. Phase 4: Configuration & Deployment

1.  **Build Frontend:** Run `npm run build` in the React project.
2.  **Serve Frontend:** Configure the Node.js backend to serve the static files from the `dist` or `build` folder on the root route `/`.
3.  **Start Services:**
    *   Start Ollama: `ollama serve`
    *   Start Backend: `pm2 start server/dist/server.js --name "agent-backend"`
4.  **Firewall:** Open port 3001 (or 80/443 if using a reverse proxy) on the Windows Server firewall.

---

## 6. Specific Configuration for Llama 3.2

When sending requests to your new backend AI proxy, ensure the JSON payload targets the correct model:

```json
{
  "model": "llama3.2",
  "stream": false,
  "format": "json",
  "options": {
    "temperature": 0.7,
    "num_ctx": 4096
  }
}
```

## 7. Security Hardening
*   **SSL:** Use a reverse proxy (IIS or Caddy for Windows) to terminate SSL. Do not expose the Node.js port directly to the public internet.
*   **Secrets:** Create a `.env` file in the `server` directory. Store `JWT_SECRET` and `DB_PASSWORD` there. Never commit this file.

---

## 8. Domain & URL Configuration (SuperAgent.tallman.com)

To make the application accessible via `SuperAgent.tallman.com` anywhere on the network:

### 8.1 DNS Configuration
1.  Access your **DNS Manager** (Windows DNS Server or Domain Provider for `tallman.com`).
2.  Locate the Forward Lookup Zone for `tallman.com`.
3.  Create a new **A Record** (or CNAME if appropriate):
    *   **Name:** `SuperAgent`
    *   **IP Address:** [Enter the IP Address of your Windows Server]
4.  Flush DNS on client machines or wait for propagation (`ipconfig /flushdns`).

### 8.2 IIS Reverse Proxy Setup
Since the Node.js app typically runs on port 3001, use IIS to handle the domain traffic and proxy it to the application.

1.  **Prerequisites:** Install **Application Request Routing (ARR)** and **URL Rewrite** modules via the Web Platform Installer in IIS.
2.  **Enable Proxy:** Open IIS Manager -> Server Node -> Application Request Routing Cache -> Server Proxy Settings -> Check "Enable proxy".
3.  **Create Website:**
    *   Right-click "Sites" -> "Add Website".
    *   **Site Name:** `SuperAgent`
    *   **Physical Path:** `C:\inetpub\wwwroot` (or a blank folder).
    *   **Binding:** Type: `http`, Port: `80`, Host name: `SuperAgent.tallman.com`.
4.  **Configure Rewrite Rule:**
    *   Select the new "SuperAgent" site.
    *   Open "URL Rewrite".
    *   Click "Add Rule(s)..." -> "Reverse Proxy".
    *   **Inbound Rules:** Enter `localhost:3001` (or your Node.js port).
    *   Check "Enable SSL Offloading" if terminating SSL at IIS.
5.  **SSL/TLS (HTTPS):**
    *   Obtain an SSL certificate for `SuperAgent.tallman.com` (or a wildcard `*.tallman.com`).
    *   Add an HTTPS binding (Port 443) to the site using this certificate.
