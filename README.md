# Antigravity Server Control Center (`antigravity-web`)

A ChatGPT/Gemini-style web interface and live server control center that connects to the **Antigravity CLI (`agy`)** running with `--dangerously-skip-permissions` to manage your home server, Docker containers, files, and services.

---

## Features

- **Real-Time Streaming Chat**: Connects to `agy -p ... --output-format stream-json --dangerously-skip-permissions` over WebSockets, streaming reasoning (`thinking`), tool executions (`run_command`, `edit_file`, `view_file`, etc.), and markdown responses in real time.
- **Persistent Multi-Turn Conversations**: Automatically tracks `agy` `conversation_id` per thread and resumes sessions using `--conversation <id>`.
- **Dual Execution Modes**:
  - **Local / Mounted Mode (`local`)**: Runs the mounted `agy` binary directly with access to `/var/run/docker.sock`, `/workspace`, and `/host`.
  - **Host SSH Mode (`ssh`)**: Executes `agy` directly on your host OS via SSH (`SSH_USER@SSH_HOST`) when you want commands to run natively on the host kernel/systemd.
- **Live Server & Docker Telemetry Panel**: Real-time CPU load, RAM usage, root disk space, and Docker container statuses with 1-click **Restart** and **Logs** actions.
- **Built-in Password Authentication**: Protected by `AUTH_PASSWORD` in `.env` (or can be disabled by setting `AUTH_PASSWORD=` if behind Tailscale/VPN).

---

## Quick Start (Local Development)

1. Install dependencies:
   ```bash
   cd /home/albert/Documents/Projects/antigravity-web
   npm install
   ```

2. Configure `.env` (created automatically from `.env.example`):
   ```env
   PORT=3001
   AUTH_PASSWORD=admin
   AGY_BIN=/home/albert/.local/bin/agy
   AGY_DEFAULT_CWD=/home/albert/Documents/Projects
   AGY_EXEC_MODE=local
   ```

3. Start the dev server (runs both Backend API/WebSocket on `:3001` and Vite Frontend on `:5173`):
   ```bash
   npm run dev
   ```

---

## Deploying on Your Home Server with Docker Compose

1. Make sure you have authenticated `agy` once on your host server (`agy` stores credentials in `~/.gemini/antigravity-cli`).
2. Copy `.env.example` to `.env` and set a strong `AUTH_PASSWORD`:
   ```bash
   cp .env.example .env
   ```
3. Launch with Docker Compose:
   ```bash
   docker compose up -d --build
   ```
4. Open `http://<your-server-ip>:3001` in your browser and log in with your `AUTH_PASSWORD`.
