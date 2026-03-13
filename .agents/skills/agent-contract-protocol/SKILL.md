---
name: agent-contract-protocol
description: Enforces CONTRACTS folder protocol between frontend and backend agents.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# Agent Contract Protocol

You are enforcing the contract-first protocol that governs communication between frontend and backend work in this crossword puzzle mobile game.

## Step 1 — Ensure CONTRACTS Folder Structure

Verify that `CONTRACTS/` contains all required files. Create any that are missing with sensible defaults.

| File | Purpose |
|---|---|
| `api.contract.json` | API endpoint definitions (request/response shapes, auth, status codes) |
| `level.schema.json` | Crossword level data shape (grid, clues, metadata) |
| `events.contract.md` | Analytics event names and payloads |
| `decisions.log.md` | Append-only log of architectural decisions |
| `status.frontend.md` | Current frontend implementation status |
| `status.backend.md` | Current backend implementation status |

### `api.contract.json` — Scaffold if Missing

```json
{
  "contractVersion": "1.0.0",
  "updatedAt": "<ISO 8601>",
  "endpoints": []
}
```

### `level.schema.json` — Scaffold if Missing

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CrosswordLevel",
  "type": "object",
  "properties": {},
  "required": []
}
```

### `events.contract.md` — Scaffold if Missing

```markdown
# Analytics Events Contract

## Events

(No events defined yet.)
```

### `decisions.log.md` — Scaffold if Missing

```markdown
# Decisions Log

Append-only. Newest entries at the bottom.
```

### `status.frontend.md` / `status.backend.md` — Scaffold if Missing

```markdown
# [Frontend/Backend] Status

Last updated: <date>

## Components

(None tracked yet.)
```

## Step 2 — Validate `api.contract.json`

Ensure the contract file has:

- `contractVersion` — semantic version string (e.g., `"1.0.0"`).
- `updatedAt` — ISO 8601 timestamp of last modification.
- `endpoints` — array of endpoint definitions.

Each endpoint must have:
```json
{
  "method": "POST",
  "path": "/functions/v1/getLevel",
  "description": "Fetch a crossword level by ID",
  "auth": "bearer (anon key)",
  "request": { "body": { "level_id": "uuid" } },
  "response": { "200": { "...level data..." }, "400": { "error": "string" } }
}
```

If `contractVersion` is missing, add it as `"1.0.0"`.

## Step 3 — Breaking Change Protocol

Document and enforce these rules:

### Backend Changes
1. **Update `api.contract.json` FIRST** — bump `contractVersion` minor for additions, major for breaking changes.
2. Update `updatedAt`.
3. Implement the change.
4. Update `status.backend.md`.
5. Append a decision entry to `decisions.log.md`.

### Frontend Changes
1. **Read `api.contract.json` as the source of truth** — never assume an endpoint exists without checking.
2. If a needed endpoint is missing, **do not create it** — document the need in `decisions.log.md` and flag it as a backend TODO.
3. Update `status.frontend.md` after changes.

### Breaking Change Handling
A breaking change is any modification that would cause existing consumers to fail:
- Removing an endpoint.
- Removing or renaming a required field.
- Changing a field's type.
- Changing authentication requirements.

For breaking changes:
1. Bump `contractVersion` major (e.g., `1.x.x` → `2.0.0`).
2. Add a `deprecated` field to the old endpoint definition (if keeping it temporarily).
3. Document the migration path in `decisions.log.md`.
4. Both frontend and backend status files must acknowledge the version bump.

## Step 4 — Update Decisions Log

Append to `CONTRACTS/decisions.log.md`:

```markdown
## <date> — Contract Protocol Enforced

- Verified CONTRACTS folder structure.
- Contract version: <version>.
- Files created/validated: <list>.
- Notes: <any observations>.
```

## Rules

- **Backend updates the contract first.** The contract is the single source of truth for the API surface.
- **Frontend reads the contract as source of truth.** Never hardcode endpoint paths or response shapes — derive them from the contract (or at minimum, validate against it).
- `decisions.log.md` is **append-only**. Never delete or modify existing entries.
- All contract files must be committed to git — they are not secrets.
- Status files are informational and can be overwritten, but should always reflect the current state.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/agent-contract-protocol validate` to only validate existing files).
