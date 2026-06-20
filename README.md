# ChatGPT Context Bridge

Private, draft-only tooling for staging ChatGPT or Codex conversations into reviewable Homebase markdown, Notion draft payloads, and image-generation asset manifests.

## What It Does

- Parses official ChatGPT `conversations.json` exports and manual markdown chat captures.
- Redacts secrets and common personal contact data before writing staged records.
- Classifies staged conversations into Homebase-style destinations.
- Exposes MCP tools for ChatGPT/Codex clients.
- Bundles Codex skills and OpenAI skill copies for reusable agent behavior.
- Appends audit events for every staging write operation.
- Writes only under `CONTEXT_BRIDGE_DATA_DIR`; it does not mutate Notion or Homebase canon.

## Install

```powershell
npm install
npm run build
npm test
npm run verify
```

Optional environment:

```powershell
Copy-Item .env.example .env.local
$env:CONTEXT_BRIDGE_DATA_DIR = "C:\Users\built\Documents\Codex\context-bridge-data"
$env:CONTEXT_BRIDGE_IMPORT_ROOTS = "C:\Users\built\Downloads,C:\Users\built\Documents"
```

## CLI

```powershell
npm run cli -- stage --source .\tests\fixtures\conversations.json --tags chatgpt,homebase
npm run cli -- search --query bridge
npm run cli -- homebase --id <staged-chat-id>
npm run cli -- notion --id <staged-chat-id>
npm run cli -- image --source .\image.png --source-kind local_file --chat-id <staged-chat-id>
npm run cli -- generate-image --prompt "A clean visual system diagram"
```

## MCP Tools

- `stage_chat`: read an export/markdown file, redact, classify, and write staging artifacts.
- `search_context`: search staged records.
- `summarize_thread`: inspect one staged chat summary.
- `propose_homebase_note`: create a staged Homebase markdown draft.
- `propose_notion_page`: create a staged Notion payload.
- `register_image_asset`: record image prompt/source/rights metadata and optionally copy a local image into staging.
- `generate_image_asset`: generate an OpenAI image into staging and return the local file path. Requires `OPENAI_API_KEY`.

## Codex Plugin

The plugin bundle lives in `plugin/` and includes:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- `skills/context-bridge-ingest`
- `skills/context-bridge-routing`

For local testing from the package root, build first, then point a local plugin marketplace at the `plugin` folder or copy the package as a whole so `plugin/scripts/context-bridge-mcp.mjs` can find `dist/index.js`.

## ChatGPT Apps SDK Connector

Use the phrase "ChatGPT Apps SDK connector backed by this MCP server" for the ChatGPT side. The local Codex plugin is separate from a ChatGPT app connector.

- Local MCP development can use stdio or `http://127.0.0.1:<PORT>/mcp`.
- ChatGPT developer-mode connection should use a reachable HTTPS `/mcp` endpoint.
- Authenticated or customer-specific use should add OAuth 2.1 or scoped bearer-token auth, server-side scope enforcement, and audit review.
- v0.1 deliberately exposes staging tools only; any future canonical write tool must be a separate tool with explicit human confirmation.

## OpenAI Skills

OpenAI skill copies live in `openai-skills/`. They are intentionally small wrappers around the MCP tool contract:

- `context-bridge-ingest`
- `context-bridge-routing`

Official OpenAI docs support Skills for `gpt-5.5`. Treat `gpt-5.5-pro` as MCP/tool-capable but not Skills-capable unless OpenAI documentation changes.

## Safety Boundaries

- No browser scraping in v0.1.
- No live sync in v0.1.
- No Notion mutation in v0.1.
- No Homebase canonical writes in v0.1.
- No image publication in v0.1; generated images stay in staging until reviewed.
- Staged Notion payloads include a direct-fetch verification reminder because Notion search can lag or miss items.
- Prompt-injection content inside imported chats is treated as staged source text, not executable routing authority.

## Verification

The test suite covers parsers, staging, duplicate imports, redaction, path traversal, prompt-injection containment, every MCP handler, plugin packaging, and one acceptance path from source chat to Homebase and Notion drafts.
