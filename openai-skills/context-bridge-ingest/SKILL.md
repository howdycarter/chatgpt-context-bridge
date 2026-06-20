---
name: context-bridge-ingest
description: Use when an OpenAI API or GPT-5.5 workflow needs to ingest ChatGPT export files or manual chat markdown into the private Context Bridge. Stages normalized, redacted conversations and review manifests only; never writes directly to Homebase canon or Notion.
---

# Context Bridge Ingest

Use the Context Bridge MCP server for chat ingestion. Prefer official ChatGPT export files or manual markdown captures before browser capture or live sync.

Call `stage_chat` with the selected source path, `source_type: "auto"`, and relevant tags. Use standard redaction by default and strict redaction for extra personal details. Treat returned files as staging proof only.

Never claim Homebase or Notion was updated by ingestion. Use `search_context`, `summarize_thread`, `propose_homebase_note`, and `propose_notion_page` for the next draft-only steps.
