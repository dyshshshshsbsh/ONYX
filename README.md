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
- [Performance](#performance)
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

## Performance

Onyx targets genuinely modest hardware (the reference machine is a 2016 mobile Xeon with a 4GB laptop GPU), so inference performance is treated as a first-class concern, not an afterthought.

**Inference profiles (Fast / Balanced / Deep).** Every chat message is sent to the model through a centralized profile (`packages/backend/src/services/aiProvider/InferenceProfiles.ts`) rather than scattered, ad-hoc parameters. The profile controls `think`, `num_ctx`, `num_predict`, `temperature`, and `top_p` together, and picks its context-window sizes based on *detected* VRAM (queried from `nvidia-smi`) rather than a hardcoded constant — the same profile stays safe on a 4GB card and scales up automatically on a bigger one. Pick the profile per message from the segmented control next to the chat composer:

| Profile | Thinking | Typical use |
|---|---|---|
| **Fast** | off | Quick factual questions, short context, hard-capped generation length |
| **Balanced** | off | Default day-to-day use |
| **Deep** | on (if the model supports it) | Hard problems where you want full reasoning and are fine waiting |

**Model-capability awareness.** `ModelCapabilityService` reads each model's advertised capabilities (from Ollama's `/api/tags`) and caches them briefly. The `think` parameter is only ever sent to models that actually declare a `"thinking"` capability — Deep mode silently degrades to non-thinking behavior on a model that doesn't support it, rather than sending a parameter the model doesn't understand.

**Bounded generation.** Every profile sets a finite `num_predict`. Previously, nothing capped generation length, and a reasoning model like qwen3 could — and did — ramble for 1000+ invisible "thinking" tokens before answering a one-word question, each one costing real wall-clock time on this hardware.

**Context management.** `ContextManager.buildInferenceContext` keeps the full conversation visible in the UI forever, but trims what's actually sent to the model: the system prompt is always kept, then as many of the most recent messages as fit a token budget derived from the active profile's `num_ctx` (recent messages first; oldest dropped first). When messages are omitted, a short synthetic system note tells the model so, and the UI shows a "context trimmed" badge on that reply. This is a deliberate trade-off over LLM-based summarization: summarizing old context would itself cost another generation pass, which is more expensive than it saves on hardware this constrained.

**Model keep-alive & warm-up.** Every request explicitly sets Ollama's `keep_alive` from **Settings → Ollama**, and an optional **Warm model on startup** toggle preloads the default model when the backend boots (via an empty-`messages` request, Ollama's documented no-op preload call) so the very first real message doesn't pay model-load latency.

**Streaming render performance.** This was the single biggest real bottleneck found during profiling: the chat UI re-ran the *entire* accumulated response through `react-markdown` + `rehype-highlight` on every incoming token, which made the live-preview cost grow roughly with the square of the response length — and that CPU work directly competed with Ollama's own inference threads on a 4-core machine. The fix has two parts:
- `packages/frontend/src/services/realtime.ts` buffers incoming token deltas per message and flushes them to the UI at most once per animation frame, regardless of how fast tokens arrive.
- The *live* streaming bubble renders plain text (`white-space: pre-wrap`), not Markdown. Markdown and syntax highlighting run exactly once, after the message finishes, in the persisted `MessageBubble`.

**One generation at a time.** This hardware cannot usefully run two local generations concurrently. `OllamaRuntimeTracker` enforces a global single-flight guard — a second `chat:send` while one is already in progress is rejected immediately with a clear error rather than silently queued or left to contend for the same CPU/GPU.

**Real cancellation.** Stopping a generation aborts the `AbortController` behind the fetch to Ollama, which closes the underlying connection — Ollama itself detects the dropped connection and stops computing (verified live: GPU utilization drops to 0% within ~1 second of clicking Stop, not just the UI hiding a partial response).

**Telemetry, not guesses.** The Dashboard's AI Runtime card and each assistant message's footer show real, measured values: time-to-first-token (TTFT), tokens/sec, prompt/completion token counts, model state (`ready` / `loading` / `idle`, derived from Ollama's own `/api/ps`), and a hardware warning when a loaded model's VRAM footprint exceeds what the detected GPU can hold (meaning Ollama is splitting it between GPU and CPU). GPU polling itself is throttled while a generation is active, to avoid spawning an extra `nvidia-smi` process competing for the same CPU mid-inference.

**What was investigated and deliberately *not* built:** Flash Attention and KV-cache quantization are Ollama *server* startup flags (`OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE`), not per-request API options — there is no API call this app can make to toggle them on an already-running Ollama service. Settings → Ollama explains this and how to set them yourself if your hardware benefits.

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
Pick **Fast** from the profile switch next to the composer — it disables thinking (on models that support turning it off) and caps generation length, which bounds the worst case. Reasoning models (qwen3 and similar) can still narrate "thinking"-style text inside their visible answer even with thinking off — this is a model/template quirk Ollama doesn't fully suppress on every version, not something this app's `think` flag controls — but the `num_predict` cap still bounds how long that can run. The Dashboard's AI Runtime card shows real TTFT and tokens/sec so you can see what your hardware is actually achieving; see [Performance](#performance) for the full picture.

**A tool keeps asking for confirmation even though I set Automatic tool execution.**
Automatic execution only applies to low-risk tools, and only when **Settings → Security → Auto-execute low risk** is also on. Medium- and high-risk tools (anything that writes, runs commands, etc.) always respect their own confirm-medium/confirm-high toggles regardless of that setting — this is intentional.
