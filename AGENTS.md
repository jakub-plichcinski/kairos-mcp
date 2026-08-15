# KAIROS

Repository-specific agent guidance for this codebase. This file is a **thin
router**: it states what KAIROS is, points to the single sources of truth, and
keeps only the notes agents need at **runtime**.

KAIROS MCP is a Model Context Protocol server for persistent memory and
deterministic adapter execution. It stores workflows as linked adapters whose
layers can carry proof-of-work challenges. You execute an adapter run by calling
**`activate`** (semantic match), then **`forward`** for each layer’s contract
(loop until `next_action` directs you to **`reward`**), then **`reward`** to
finalize the run. Every hash, nonce, and identifier is server-generated; echo
them verbatim — never compute them.

## Core functionality

Action routing for agents is defined in
**[`.agents/skills/kairos/SKILL.md`](.agents/skills/kairos/SKILL.md)** — the
single source of truth for the **`activate`** → **`forward`** → **`reward`**
chain (hosts also load it from `~/.agents/skills/kairos/SKILL.md`). Do not paste
that routing guidance here; keep it in one place.

If KAIROS MCP is **unavailable or unauthenticated**, treat that as a **critical
error** and stop; fix the host connection per
**[docs/install/README.md#cursor-and-mcp](docs/install/README.md#cursor-and-mcp)**
and **[`.agents/skills/kairos-dev/references/mcp-host-bridge.md`](.agents/skills/kairos-dev/references/mcp-host-bridge.md)**.

For **real MCP calls**, follow the **connected server’s** tool names, schemas,
and descriptions; for **implementation in this repository**, follow this
worktree’s source, tests, and embedded docs (`src/embed-docs/tools/` is the
authoritative execution contract).

## Development

- **Contributor setup, build/test contract, code style, and design
  principles:** [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Maintainer workflows** (build/test, bug-fix ship, release, MCP QA, Git
  safety, UI specs, wiki publishing): the
  [`kairos-dev`](.agents/skills/kairos-dev/SKILL.md) skill and its
  [`references/`](.agents/skills/kairos-dev/references/).
- **Code-derivable reference** (architecture, auth, storage, search, workflow
  engine, testing topology): the
  [project Wiki](https://github.com/jakub-plichcinski/kairos-mcp/wiki).

## Runtime authority split

**CRITICAL:** Agents are connected to a real KAIROS MCP server at runtime.
Use the version shown at connect, the connected server's tool list, and the
connected server's tool descriptions as the authority for MCP calls.

When the connected MCP surface differs from this worktree:

- For actual MCP calls, follow the connected server's runtime contract.
- For code changes in this repo, implement the target behavior described by
  this branch's source, tests, and embedded docs.
- If runtime and worktree differ, call out the mismatch before proceeding.
- Do not use the current branch name as protocol authority. Branch names are a
  hint only.

## Cursor agent MCP server identifiers

When using Cursor’s **agent MCP bridge** (`call_mcp_tool`), the **server**
argument is **not** always the same string as the key in `.cursor/mcp.json`.

- **Config key (human / `mcp.json`):** e.g. `KAIROS-DEVELOPMENT` for local dev
  at `http://localhost:3300/mcp` (see `docs/install/README.md#cursor-and-mcp`).
- **Agent-visible id:** Cursor prefixes or transforms the key. Examples:
  **`project-<n>-<workspace-folder-slug>-<key>`** for workspace-scoped MCP,
  **`user-<Name>`** for user-level servers (e.g. Context7), **`plugin-…`** for
  plugin-supplied MCP, and other forms. With this repo as workspace root
  `kairos-mcp`, a common KAIROS dev id is `project-0-kairos-mcp-KAIROS-DEVELOPMENT`.

**If `call_mcp_tool` fails with “MCP server does not exist”**, read the error’s
**Available servers** list (or check Cursor’s MCP panel) and use the entry that
corresponds to your configured server — often the one ending in
`-KAIROS-DEVELOPMENT` for local dev. Do not treat any single example string as
portable across workspaces or Cursor versions.

**MCP auth or availability:** If a tool fails with auth errors or the server is
missing, follow
**[`.agents/skills/kairos-dev/references/mcp-host-bridge.md`](.agents/skills/kairos-dev/references/mcp-host-bridge.md)**
(probe with minimal calls first; do not continue without required MCP — ask the
user to fix auth or config). Cursor-specific `server` id resolution is in the
same reference under **Cursor-specific**.
