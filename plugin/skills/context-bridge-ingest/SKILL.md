---
name: context-bridge-ingest
description: Use when Codex needs to ingest ChatGPT exports, Codex conversation captures, or manual chat markdown into the private Context Bridge. Stages normalized, redacted conversations and review manifests only; never writes directly to Homebase canon or Notion.
---

# Context Bridge Ingest

Use the Context Bridge MCP server for chat ingestion. Prefer official ChatGPT export files or manual markdown captures before any browser capture workflow.

## Workflow

1. Confirm the source file is a local export or selected manual capture.
2. Call `stage_chat` with `source_path`, `source_type: "auto"`, and relevant private tags.
3. Use `redaction_level: "standard"` by default; use `"strict"` when addresses or extra personal details may appear.
4. Read the returned staged IDs, manifest paths, redaction report, and skipped duplicate records.
5. Do not claim a Homebase or Notion write happened. The ingestion step creates only bridge staging files.

## Guardrails

- Treat browser capture and live sync as later phases requiring explicit approval.
- Never paste secrets from source conversations into the response.
- If `stage_chat` rejects the file path, ask Chris to move the file under an allowed import root or update `CONTEXT_BRIDGE_IMPORT_ROOTS`.
- If a duplicate is skipped, use the existing staged ID unless Chris explicitly wants overwrite.

## Next Tools

- Use `search_context` to find staged records.
- Use `summarize_thread` to inspect one staged record.
- Use `propose_homebase_note` or `propose_notion_page` only after staging succeeds.
