#!/usr/bin/env node
import express, { type NextFunction, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  handleProposeHomebaseNote,
  handleProposeNotionPage,
  handleGenerateImageAsset,
  handleRegisterImageAsset,
  handleSearchContext,
  handleStageChat,
  handleSummarizeThread,
  ProposeHomebaseInputShape,
  ProposeNotionInputShape,
  GenerateImageAssetInputShape,
  RegisterImageAssetInputShape,
  SearchContextInputShape,
  StageChatInputShape,
  SummarizeThreadInputShape
} from "./mcp/tools.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "chatgpt-context-bridge-mcp-server",
    version: "0.1.0"
  });

  server.registerTool(
    "search_context",
    {
      title: "Search Staged Context",
      description:
        "Search private Context Bridge staging records. Read-only. Returns staged chat IDs, titles, summaries, and draft paths when present.",
      inputSchema: SearchContextInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handleSearchContext
  );

  server.registerTool(
    "stage_chat",
    {
      title: "Stage Chat Export",
      description:
        "Read a local ChatGPT export JSON or manual markdown chat file, redact sensitive values, classify it, and write only staging artifacts. Does not write to Homebase or Notion.",
      inputSchema: StageChatInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handleStageChat
  );

  server.registerTool(
    "summarize_thread",
    {
      title: "Summarize Staged Thread",
      description: "Return the deterministic summary, action candidates, and risk notes for one staged chat ID. Read-only.",
      inputSchema: SummarizeThreadInputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handleSummarizeThread
  );

  server.registerTool(
    "propose_homebase_note",
    {
      title: "Propose Homebase Note",
      description:
        "Create a staged Homebase markdown draft and suggested canonical path for one staged chat. Draft-only; no Homebase repo writes.",
      inputSchema: ProposeHomebaseInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handleProposeHomebaseNote
  );

  server.registerTool(
    "propose_notion_page",
    {
      title: "Propose Notion Page",
      description:
        "Create a staged Notion payload with verification notes for one staged chat. Draft-only; no Notion API calls or page mutations.",
      inputSchema: ProposeNotionInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handleProposeNotionPage
  );

  server.registerTool(
    "generate_image_asset",
    {
      title: "Generate Image Asset",
      description:
        "Generate an image with OpenAI image generation, save it into Context Bridge staging, and return the local staged file path plus manifest metadata. Requires OPENAI_API_KEY. Does not publish media.",
      inputSchema: GenerateImageAssetInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      }
    },
    handleGenerateImageAsset
  );

  server.registerTool(
    "register_image_asset",
    {
      title: "Register Image Asset",
      description:
        "Stage image-generation artifacts by recording prompt, source chat, usage-rights note, and optional local copied asset. Does not publish media.",
      inputSchema: RegisterImageAssetInputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handleRegisterImageAsset
  );

  return server;
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
  console.error("Context Bridge MCP server running over stdio.");
}

function requireBearerToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CONTEXT_BRIDGE_HTTP_TOKEN;
  if (!expected) {
    next();
    return;
  }

  const actual = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (actual !== expected) {
    res.status(401).json({ error: "Unauthorized. Provide the configured bearer token." });
    return;
  }
  next();
}

async function runHttp(): Promise<void> {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "chatgpt-context-bridge-mcp-server",
      status: "ok",
      mcp: "/mcp",
      writes: "draft-staging-only"
    });
  });

  app.options("/mcp", (_req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "https://chatgpt.com");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(204).send();
  });

  app.post("/mcp", requireBearerToken, async (req: Request, res: Response) => {
    const origin = req.header("origin");
    if (origin && origin !== "https://chatgpt.com" && origin !== "https://chat.openai.com") {
      res.status(403).json({ error: "Origin not allowed for Context Bridge MCP." });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => {
      void transport.close();
    });
    await createServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = Number.parseInt(process.env.PORT ?? "3333", 10);
  app.listen(port, "127.0.0.1", () => {
    console.error(`Context Bridge MCP server listening on http://127.0.0.1:${port}/mcp`);
  });
}

if (process.argv.includes("--help")) {
  console.log("Context Bridge MCP server. Set CONTEXT_BRIDGE_TRANSPORT=http for HTTP mode; default is stdio.");
  process.exit(0);
}

const transport = process.env.CONTEXT_BRIDGE_TRANSPORT ?? "stdio";
if (transport === "http") {
  void runHttp().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
} else {
  void runStdio().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
