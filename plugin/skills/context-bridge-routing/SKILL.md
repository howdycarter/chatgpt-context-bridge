---
name: context-bridge-routing
description: Use when Codex needs to turn a staged Context Bridge chat into a Homebase markdown draft, Notion draft payload, summary, route recommendation, or image-generation asset manifest. Keeps all outputs in staging until explicit review approval.
---

# Context Bridge Routing

Use this skill after a chat has already been staged with Context Bridge.

## Workflow

1. Use `search_context` if the staged chat ID is unknown.
2. Use `summarize_thread` to inspect the summary, action candidates, and risk notes.
3. For Homebase, call `propose_homebase_note`. It writes a staged markdown draft and suggests a canonical path.
4. For Notion, call `propose_notion_page`. It writes a staged JSON payload with review and direct-fetch verification notes.
5. For existing generated images, call `register_image_asset` with the prompt, source chat ID when known, and a usage-rights note.
6. To generate a new staged image through OpenAI, call `generate_image_asset`. It requires `OPENAI_API_KEY`, writes the image under staging, and returns the local file path.

## Filing Defaults

- Project-like work routes to `10_ACTIVE_OUTCOMES`.
- Ongoing responsibilities route to `20_LIFE_AREAS`.
- Reusable references route to `03_RESOURCES`.
- Durable insights route to `30_KNOWLEDGE_LIBRARY`.
- Ambiguous material routes to `00_META/inbox`.

## Guardrails

- Do not move or write files into Homebase canon from this skill.
- Do not call Notion mutation tools from this skill.
- Do not imply generated images are published. They are staged files until usage rights and publication context are reviewed.
- For Notion placement proof, direct page fetch ancestry outranks search snippets.
- Keep sensitive personal context private and out of shareable/public artifacts.
