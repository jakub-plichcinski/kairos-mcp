---
slug: bulk-insert-adapters-via-cli
version: "4.8.5"
title: Bulk Insert Adapters via KAIROS CLI
---

# Bulk Insert Adapters via KAIROS CLI

## Activation Patterns

Batch-register multiple KAIROS adapters from a local directory tree using the
`kairos train` CLI. Handles directory scanning, validation, space targeting,
and error recovery for bulk operations.

**Run this protocol when the user says ANY of:**

- "bulk insert adapters" / "bulk train adapters"
- "train all protocols in a directory"
- "batch register adapters from folder"
- "upload all .md files to KAIROS"
- "sync local protocols to KAIROS" / "push protocols to KAIROS"
- "train directory recursively" / "train --recursive"

**Trigger pattern:** **bulk** / **batch** / **all** / **directory** / **recursive** +
(train | insert | register | upload | push | sync) + (adapters | protocols).

**Must Never:**

- Train files without first validating their structure.
- Overwrite existing adapters without explicit user confirmation (`--force`).
- Train files that contain secrets or token-like strings without `--allow-sensitive-upload`.
- Skip reporting partial failures in a batch.

**Must Always:**

- Verify the target directory exists and contains `.md` files.
- Show the user the file list and target space before executing.
- Report per-file success/failure after the batch completes.
- Respect the user's choice of space (personal or group).

**Good trigger examples:**

- "Train all adapters in kairos-v4/_personal/" → run this protocol
- "Bulk insert the protocols from my export folder" → run this protocol
- "Push all .md files in this directory to my personal space" → run this protocol

**Bad trigger examples:**

- "Train this one protocol" → use `kairos train <file>` directly
- "Create a new protocol" → use `create-new-protocol`
- "Export my adapters" → use `kairos export`

## Preflight Dependencies

Verify before execution:

1. `kairos` CLI is installed and callable (`kairos --version`).
2. Authentication is valid (`kairos token` returns a token without error).
3. Target directory path exists and contains at least one `.md` file.
4. If a space is specified, confirm it exists via `kairos spaces`.

If any check fails, stop and report the issue with remediation guidance.

```json
{"contract":{"type":"shell","shell":{"cmd":"kairos --version && kairos token > /dev/null 2>&1 && echo 'auth: ok'","timeout_seconds":15},"required":true}}
```

## Confirm Scope

Present the batch operation details to the user:

1. **Source directory** — absolute path.
2. **File count** — number of `.md` files found (recursive or flat).
3. **Target space** — personal (default) or a named group space.
4. **Force mode** — whether `--force` will be used (overwrites existing).
5. **Model attribution** — which `--model` value to use.

List the files that will be trained and ask for confirmation.

```json
{"contract":{"type":"user_input","user_input":{"prompt":"Confirm batch scope: directory, file list, target space, force mode, and model ID"},"required":true}}
```

## Validate Structure

Before training, validate each `.md` file against KAIROS adapter requirements:

- Has an H1 title.
- First H2 is "Activation Patterns".
- Last H2 is "Reward Signal".
- Contains at least one fenced `json` block with a top-level `contract` object.
- Does not exceed 350 lines.

Report any files that fail validation. Ask user whether to:
- skip invalid files and proceed with valid ones
- abort and fix issues first

```json
{"contract":{"type":"shell","shell":{"cmd":"echo 'Validation complete — see output above for results'","timeout_seconds":30},"required":true}}
```

## Execute Bulk Train

Run the batch train operation using the KAIROS CLI:

```
kairos train <directory> --recursive --model <model> --space <space> [--force]
```

If the directory contains files that should NOT be trained (README, reference
docs), either:
- train file-by-file for the valid subset, or
- move non-adapter files out before running `--recursive`

Capture stdout and stderr. The CLI reports per-file status.

```json
{"contract":{"type":"shell","shell":{"cmd":"kairos train <directory> --recursive --model <model_id> --space <space>","timeout_seconds":120},"required":true}}
```

## Report Results

Summarise the batch outcome:

| Metric | Value |
|--------|-------|
| Files attempted | N |
| Successfully trained | N |
| Failed | N |
| Skipped (invalid) | N |

For each failure, report:
- File path
- Error message
- Suggested fix

If all succeeded, confirm adapter URIs are accessible via `kairos spaces`.

```json
{"contract":{"type":"comment","comment":{"min_length":80},"required":true}}
```

## Reward Signal

Protocol complete when:
- All valid adapter files in the target directory have been trained to the
  specified space.
- Per-file results have been reported to the user.
- Any failures have been documented with remediation guidance.

A successful bulk insert means the user's local protocol library is now
registered in KAIROS and available for activation by AI agents.
