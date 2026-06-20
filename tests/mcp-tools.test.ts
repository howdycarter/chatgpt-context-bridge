import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  handleGenerateImageAsset,
  handleProposeHomebaseNote,
  handleProposeNotionPage,
  handleRegisterImageAsset,
  handleSearchContext,
  handleStageChat,
  handleSummarizeThread
} from "../src/mcp/tools.js";

let dataDir = "";
let importDir = "";
let previousDataDir: string | undefined;
let previousImportRoots: string | undefined;
let previousApiKey: string | undefined;
let previousFetch: typeof fetch;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "context-bridge-mcp-data-"));
  importDir = await mkdtemp(path.join(os.tmpdir(), "context-bridge-mcp-import-"));
  previousDataDir = process.env.CONTEXT_BRIDGE_DATA_DIR;
  previousImportRoots = process.env.CONTEXT_BRIDGE_IMPORT_ROOTS;
  previousApiKey = process.env.OPENAI_API_KEY;
  previousFetch = globalThis.fetch;
  process.env.CONTEXT_BRIDGE_DATA_DIR = dataDir;
  process.env.CONTEXT_BRIDGE_IMPORT_ROOTS = importDir;
  process.env.OPENAI_API_KEY = "test-openai-key";
});

afterEach(async () => {
  if (previousDataDir === undefined) {
    delete process.env.CONTEXT_BRIDGE_DATA_DIR;
  } else {
    process.env.CONTEXT_BRIDGE_DATA_DIR = previousDataDir;
  }
  if (previousImportRoots === undefined) {
    delete process.env.CONTEXT_BRIDGE_IMPORT_ROOTS;
  } else {
    process.env.CONTEXT_BRIDGE_IMPORT_ROOTS = previousImportRoots;
  }
  if (previousApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousApiKey;
  }
  globalThis.fetch = previousFetch;
  await rm(dataDir, { recursive: true, force: true });
  await rm(importDir, { recursive: true, force: true });
});

describe("MCP tool handlers", () => {
  it("exercises every Context Bridge tool through its handler", async () => {
    const sourcePath = path.join(importDir, "selected-chat.md");
    await writeFile(
      sourcePath,
      [
        "# Selected Chat",
        "",
        "User: Please create a Homebase project reference for this image generation workflow.",
        "Assistant: Next step is to stage a draft and review the generated image usage rights."
      ].join("\n"),
      "utf8"
    );
    const imagePath = path.join(importDir, "generated-image.png");
    await writeFile(imagePath, "fake-image-bytes", "utf8");

    const staged = await handleStageChat({
      source_path: sourcePath,
      source_type: "auto",
      tags: ["homebase", "image-generation"],
      response_format: "json"
    });
    const stagedContent = staged.structuredContent as { staged: Array<{ id: string }> };
    const stagedChatId = stagedContent.staged[0]!.id;

    const search = await handleSearchContext({ query: "image generation", limit: 10, response_format: "json" });
    const summary = await handleSummarizeThread({ staged_chat_id: stagedChatId, response_format: "json" });
    const homebase = await handleProposeHomebaseNote({ staged_chat_id: stagedChatId, response_format: "json" });
    const notion = await handleProposeNotionPage({ staged_chat_id: stagedChatId, response_format: "json" });
    const image = await handleRegisterImageAsset({
      source: imagePath,
      source_kind: "local_file",
      prompt: "Generate a clean visual system diagram.",
      source_chat_id: stagedChatId,
      usage_rights_note: "Private draft only.",
      response_format: "json"
    });
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.openai.com/v1/images/generations");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-openai-key");
      return new Response(
        JSON.stringify({
          data: [
            {
              b64_json: Buffer.from("fake-generated-png").toString("base64"),
              revised_prompt: "A clean visual system diagram."
            }
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }) as typeof fetch;
    const generated = await handleGenerateImageAsset({
      prompt: "Generate a clean visual system diagram.",
      source_chat_id: stagedChatId,
      usage_rights_note: "Private draft only.",
      response_format: "json"
    });

    expect((search.structuredContent as { total: number }).total).toBe(1);
    expect((summary.structuredContent as { title: string }).title).toBe("Selected Chat");
    expect((homebase.structuredContent as { draftPath: string }).draftPath.startsWith(dataDir)).toBe(true);
    expect((notion.structuredContent as { draftPath: string }).draftPath.startsWith(dataDir)).toBe(true);
    expect((image.structuredContent as { storedPath: string }).storedPath.startsWith(dataDir)).toBe(true);
    const generatedPath = (generated.structuredContent as { storedPath: string }).storedPath;
    expect(generatedPath.startsWith(dataDir)).toBe(true);
    expect(await readFile(generatedPath, "utf8")).toBe("fake-generated-png");

    const audit = await readFile(path.join(dataDir, "audit", "events.jsonl"), "utf8");
    expect(audit).toContain("stage_chat");
    expect(audit).toContain("register_image_asset");
    expect(audit).toContain("generate_image_asset");
  });
});
