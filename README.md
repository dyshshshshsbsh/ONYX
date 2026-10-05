# Onyx — Local AI Command Center

A professional, local-first control console for [Ollama](https://ollama.com). Onyx is not a thin chat UI bolted onto Ollama — it's a full application shell around it: a dashboard with real hardware telemetry, an agent runtime with tool-calling and permissioned file/terminal access, a system-prompt manager, a model manager, and an observability layer, all running entirely on your machine.

Ollama is the inference engine running invisibly underneath. Everything you interact with is Onyx's own interface.

## Table of contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [The agent runtime & tools](#the-agent-runtime--tools)
- [Security model](#security-model)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Requirements

- **Node.js ≥ 22.5** (the backend uses the built-in `node:sqlite` module — see [Architecture](#architecture) for why).
- **[Ollama](https://ollama.com)** installed and at least one model pulled (`ollama pull qwen3:4b` or similar).
- Windows, macOS, or Linux. Developed and tested on Windows 10.

## Quick start

```bash
npm install
npm run dev
```

This starts the backend on `http://localhost:4319` and the frontend dev server on `http://localhost:5173` (open that URL). The frontend proxies `/api` and `/ws` to the backend, so you only ever need to open the one URL.

On first run, Onyx will:

- Create a local SQLite database at `data/app.db` (conversations, settings, prompt profiles, logs, tool-execution history).
- Seed five built-in system-prompt profiles (General Assistant, Coding Agent, Research Agent, Cybersecurity Lab, Personal Assistant).
- Default its one workspace root to `~/Desktop/MY Agent` — the agent's filesystem and terminal tools can only touch paths inside configured workspace roots. Add more (or change it) under **Settings → Security → Workspace Roots**.

For a production build:

```bash
npm run build     # builds shared, backend, and frontend
npm run start -w @lacc/backend   # serve the backend (then serve packages/frontend/dist with any static file server)
```

## Architecture

```
                         LOCAL AI COMMAND CENTER
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                 Frontend                    Backend
             React / TypeScript         Node.js / TypeScript
             (packages/frontend)         (packages/backend)
                    │                           │
                    └─────────────┬─────────────┘
                          REST (control) + WebSocket (live)
                                  │
                           Agent Runtime
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
          Ollama               Tools               System
      (AIProvider abstraction) (filesystem,      Monitor (CPU/RAM
                                 terminal,         via systeminformation,
                                 system info)       GPU via nvidia-smi)
```

**Real-time transport.** One WebSocket connection (`/ws`) carries chat token streaming, agent activity events, permission-confirmation prompts, terminal output, model-pull progress, system snapshots, and log entries — all as a single discriminated-union `ServerEvent` type shared between frontend and backend (`packages/shared`). REST handles CRUD (conversations, settings, prompt profiles, files).

**Provider abstraction.** The backend never talks to Ollama's HTTP API directly from application code — `OllamaService` wraps the raw API, and `OllamaProvider` implements a generic `AIProvider` interface (`listModels`, `streamChat`) that the agent runtime depends on. Adding a second local engine (an OpenAI-compatible server, LM Studio, etc.) means implementing that one interface; nothing else in the app needs to change.

**Why `node:sqlite` instead of `better-sqlite3`.** The backend's persistence layer (`packages/backend/src/storage/db.ts`) uses Node's built-in, synchronous SQLite module rather than a third-party native addon. On this project's reference hardware, `better-sqlite3` reliably crashed the whole Node process (a native assertion failure in its `Statement` cleanup path) on a very current Node version. `node:sqlite` ships inside Node core, so it's always ABI-matched to whatever Node you're running — there's no prebuilt native binary that can go stale. It also means `npm install` never needs a C++ build toolchain.

**Thinking-model handling.** Reasoning models (qwen3 and similar) don't always emit their `<think>...</think>` reasoning the way you'd expect from the API docs — depending on the Ollama version, it can arrive in a dedicated `thinking` field, as well-formed inline tags, or (observed in practice) as a lone `</think>` marker with no opening tag, because the chat template starts "inside" reasoning mode. `ThinkTagSplitter` in `packages/backend/src/services/aiProvider/` handles all three cases: an incremental splitter keeps the live token stream clean, and once a response finishes, an authoritative full-text pass (`splitThinkTagsFull`) recomputes the correct split and corrects the persisted message. See `packages/backend/tests/aiProvider/ThinkTagSplitter.test.ts` for the exact scenarios this guards against.

## Project structure

```
packages/
  shared/              Types, constants, and the ServerEvent/ClientCommand wire protocol
    src/types/         chat, models, tools, agent, system, settings, logs, ws
  backend/
    src/
      api/             REST routes (conversations, models, settings, prompt-profiles, fs, system, tools, logs, diagnostics)
      ws/               WebSocket server — chat streaming, agent events, terminal, system snapshots
      services/
        ollama/         Raw Ollama HTTP API client (OllamaService)
        aiProvider/      Provider abstraction (AIProvider) + OllamaProvider + ThinkTagSplitter
        agent/           AgentRuntime (the tool-calling loop) + ConfirmationBroker
        tools/           Tool registry + filesystem/terminal/system tool implementations
        security/        PermissionManager, workspace path validation, blocked-command policy
        monitoring/      CPU/RAM (systeminformation) + GPU (nvidia-smi) + Ollama runtime tracker
        terminal/        Real child_process execution service (streaming, timeout, cancellation)
        logging/         Structured logger with configurable level, persisted to SQLite
      storage/           node:sqlite connection, schema, and one repository module per entity
    tests/               vitest — security, tools, storage, ollama, aiProvider
  frontend/
    src/
      pages/             Dashboard, Chat, Agent, Models, Tools, System, Logs, Settings
      components/        Design-system components, chat UI, charts, tools sub-pages, settings UI
      stores/             zustand stores (conversations, system, models, tools, settings, toasts, UI)
      services/           Typed REST client + WebSocket event-bus client
    tests/               vitest + @testing-library/react
```

## Configuration

Everything in **Settings** is backed by a single `AppSettings` object persisted in SQLite (`packages/backend/src/storage/repositories/settingsRepository.ts`), with no file-format lock-in beyond that.

| Section | Covers |
|---|---|
| General | Theme (dark/light/system), notifications, launch-on-startup |
| AI | Default model, temperature, top-p, context size, streaming, reasoning display |
| Agent | Tools on/off, automatic execution, confirmation mode, max iterations, tool timeout |
| System Prompts | Full CRUD over prompt profiles; built-ins are read-only, duplicate to customize |
| Ollama | Endpoint URL, keep-alive |
| Monitoring | Snapshot refresh interval, chart history length, GPU monitoring toggle |
| Security | Workspace roots, per-category permissions, risk-based confirmation defaults, blocked command substrings |

## The agent runtime & tools

Agent mode (toggle in the Chat composer) runs a bounded tool-calling loop (`AgentRuntime.run`):

```
user message → stream from model (with tool schemas attached)
  → model requests a tool call?
      → evaluate permission (PermissionManager): allow / confirm / deny
      → if "confirm": pause and wait for the user's decision over the WebSocket
      → execute the tool (with its own timeout) → feed the result back to the model
      → loop (bounded by Settings → Agent → Maximum iterations)
  → no tool call → stream the final answer → done
```

Built-in tools (`packages/backend/src/services/tools/`):

| Tool | Risk | Notes |
|---|---|---|
| `list_directory`, `read_file`, `search_files` | low | Read-only, confined to workspace roots |
| `create_file`, `write_file`, `edit_file`, `move_file` | medium | `edit_file` requires an exact, unique match (no fuzzy patching) |
| `run_command` | high | Real `child_process`, streamed output, timeout, checked against blocked-command patterns |
| `get_system_information`, `get_process_information` | low | Same data source as the Dashboard/System pages |

Every tool call is persisted (`tool_executions` table) and visible on the **Agent** page's live timeline, independent of which conversation you're currently viewing.

## Security model

- **Workspace confinement.** All filesystem and terminal operations resolve through `resolveWorkspacePath`, which rejects any path — including sibling directories that merely share a name prefix — outside the configured workspace roots.
- **Explicit permissions.** Six categories (file read/create/modify/delete, terminal execute/admin, network, system read/modify) are off by default for anything destructive (`fileDelete`, `terminalAdmin`, `networkAccess`, `systemModifySettings`) and can be flipped per-category in **Settings → Security** or the **Tools** page.
- **Risk-based confirmation.** Every tool declares a risk level (low/medium/high). `PermissionManager` combines that with your confirmation-mode setting (always / risk-based / never) to decide whether a call needs your explicit sign-off — shown as a modal with the tool name, arguments, and risk badge, with **Allow Once**, **Allow Session**, or **Deny**.
- **Blocked command patterns.** A configurable substring blocklist (default includes `shutdown`, `format `, destructive `rm -rf /`-style patterns) is checked before any command reaches a shell, in both the agent's `run_command` tool and the standalone Terminal page.
- **No silent elevation.** Onyx never runs commands as Administrator; the `terminalAdmin` permission exists but nothing in the app currently requests elevation.

## Development

```bash
npm run dev          # backend + frontend, both with hot reload
npm run dev:backend  # backend only
npm run dev:frontend # frontend only
npm run typecheck    # tsc --noEmit across all three packages
npm run lint         # eslint across backend + frontend
npm run build        # production build of all three packages
```

The backend data directory defaults to `<repo root>/data`; override with the `LACC_DATA_DIR` environment variable. The backend port defaults to `4319`; override with `LACC_BACKEND_PORT`.

## Testing

```bash
npm run test   # backend (vitest) + frontend (vitest + @testing-library/react)
```

Backend tests hit real behavior wherever practical rather than mocking it away: `run_command` spawns a real process, `get_system_information` queries real CPU/GPU data, filesystem tools operate against a real temp directory, and `ThinkTagSplitter` is tested against the exact malformed-tag pattern observed from a real Ollama response. Only the Ollama HTTP API itself is mocked (via `fetch`), since hitting a real Ollama server in CI isn't practical.

## Troubleshooting

**"Ollama is offline. Start Ollama and try again."**
Onyx polls `GET /api/tags` on your configured endpoint (default `http://127.0.0.1:11434`, change under **Settings → Ollama**) every few seconds. Make sure `ollama serve` is running and reachable.

**GPU card shows "GPU metrics unavailable."**
Onyx shells out to `nvidia-smi` for GPU/VRAM telemetry. If you don't have an NVIDIA GPU, or `nvidia-smi` isn't on your `PATH`, the Dashboard will say so explicitly rather than show a fabricated number — there is currently no AMD/Intel GPU backend.

**Responses are very slow, or Agent Mode seems to hang.**
Reasoning models (qwen3 and similar) can generate a large internal reasoning trace before any visible output — on modest hardware without a capable GPU this can take minutes for even a short prompt. Check **Settings → AI → Show reasoning**; turning it off requests less work from the model, but the real limiting factor is raw inference speed on your hardware. The Dashboard's "Last speed" (tokens/sec) under AI Runtime tells you what your hardware is actually achieving.

**A tool keeps asking for confirmation even though I set Automatic tool execution.**
Automatic execution only applies to low-risk tools, and only when **Settings → Security → Auto-execute low risk** is also on. Medium- and high-risk tools (anything that writes, runs commands, etc.) always respect their own confirm-medium/confirm-high toggles regardless of that setting — this is intentional.
