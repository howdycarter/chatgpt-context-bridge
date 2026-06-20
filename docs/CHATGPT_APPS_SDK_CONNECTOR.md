# ChatGPT Apps SDK Connector Notes

This package is ready for local MCP use through stdio and for local HTTP development through `/mcp`. For ChatGPT, describe this as a ChatGPT Apps SDK connector backed by an MCP server, not as a legacy ChatGPT plugin.

## Local HTTP Development

```powershell
$env:CONTEXT_BRIDGE_TRANSPORT = "http"
$env:PORT = "3333"
npm run start:http
```

Health check:

```text
GET http://127.0.0.1:3333/
POST http://127.0.0.1:3333/mcp
```

## Production Connector Requirements

- Serve `/mcp` over HTTPS.
- Add OAuth 2.1 or a scoped bearer-token layer before exposing it outside localhost.
- Enforce scopes server-side on every call; do not rely on client-side labels.
- Keep `CONTEXT_BRIDGE_DATA_DIR` on private storage.
- Keep import roots narrow with `CONTEXT_BRIDGE_IMPORT_ROOTS`.
- Review audit events under `audit/events.jsonl`.
- Leave all Homebase and Notion writes disabled until a separate reviewed write tool exists.
- Keep read/write behavior split into separate tools so ChatGPT can apply confirmation flows.
- After any future Notion write, verify by direct page fetch ancestry, not search snippets.

## ChatGPT App Shape

For a ChatGPT Apps SDK app, register this MCP server as the tool backend. UI components can be added later for staged-record review, but v0.1 intentionally ships the tool surface first:

- `stage_chat`
- `search_context`
- `summarize_thread`
- `propose_homebase_note`
- `propose_notion_page`
- `register_image_asset`
- `generate_image_asset`

## Official OpenAI References

- Apps SDK quickstart: https://developers.openai.com/apps-sdk/quickstart
- Apps SDK MCP server concept: https://developers.openai.com/apps-sdk/concepts/mcp-server
- Build your MCP server: https://developers.openai.com/apps-sdk/build/mcp-server
- Define tools: https://developers.openai.com/apps-sdk/plan/tools
- Connect from ChatGPT: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- Authentication: https://developers.openai.com/apps-sdk/build/auth
- Security and privacy: https://developers.openai.com/apps-sdk/guides/security-privacy
- OpenAI Skills: https://developers.openai.com/api/docs/guides/tools-skills
- GPT-5.5 model: https://developers.openai.com/api/docs/models/gpt-5.5
- GPT-5.5 Pro model: https://developers.openai.com/api/docs/models/gpt-5.5-pro
- Image generation in Responses API: https://developers.openai.com/api/docs/guides/images-vision
