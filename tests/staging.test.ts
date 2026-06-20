import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proposeHomebaseNote, proposeNotionPage, searchContext, stageChatFromFile } from "../src/services/staging.js";

let dataDir = "";
const fixtureDir = path.resolve("tests", "fixtures");

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "context-bridge-test-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("staging workflow", () => {
  it("stages an export and creates Homebase and Notion drafts only in data dir", async () => {
    const stageResult = await stageChatFromFile(
      {
        sourcePath: path.join(fixtureDir, "conversations.json"),
        sourceType: "auto",
        tags: ["acceptance"],
        allowOverwrite: false,
        redactionLevel: "standard"
      },
      { dataDir, allowedImportRoots: [fixtureDir] }
    );

    expect(stageResult.staged).toHaveLength(1);
    const stagedId = stageResult.staged[0]!.id;
    expect(stageResult.staged[0]!.conversationPath.startsWith(dataDir)).toBe(true);

    const search = await searchContext("Context Bridge", 10, 0, { dataDir, allowedImportRoots: [fixtureDir] });
    expect(search.total).toBe(1);

    const homebase = await proposeHomebaseNote(stagedId, { dataDir, allowedImportRoots: [fixtureDir] });
    expect(homebase.draftPath.startsWith(dataDir)).toBe(true);
    expect(homebase.suggestedCanonicalPath).toMatch(/^\d{2}_|^10_ACTIVE_OUTCOMES|^00_META/);
    const note = await readFile(homebase.draftPath, "utf8");
    expect(note).toContain("Canonical-write status: draft only");
    expect(note).toContain("[REDACTED_EMAIL]");

    const notion = await proposeNotionPage(stagedId, { dataDir, allowedImportRoots: [fixtureDir] });
    expect(notion.draftPath.startsWith(dataDir)).toBe(true);
    expect(notion.payload.verificationRequired.join(" ")).toContain("direct page fetch ancestry");

    const audit = await readFile(path.join(dataDir, "audit", "events.jsonl"), "utf8");
    const operations = audit
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line).operation);
    expect(operations).toEqual(["stage_chat", "propose_homebase_note", "propose_notion_page"]);
  });

  it("stages multiple conversations from one ChatGPT export file", async () => {
    const stageResult = await stageChatFromFile(
      {
        sourcePath: path.join(fixtureDir, "multi-conversations.json"),
        sourceType: "auto",
        tags: ["multi"],
        allowOverwrite: false,
        redactionLevel: "standard"
      },
      { dataDir, allowedImportRoots: [fixtureDir] }
    );

    expect(stageResult.staged).toHaveLength(2);
    expect(stageResult.skipped).toHaveLength(0);
    expect(stageResult.staged.map((record) => record.title).sort()).toEqual(["First Exported Chat", "Second Exported Chat"]);
  });

  it("skips duplicate imports unless overwrite is allowed", async () => {
    const input = {
      sourcePath: path.join(fixtureDir, "conversations.json"),
      sourceType: "auto" as const,
      tags: ["dedupe"],
      allowOverwrite: false,
      redactionLevel: "standard" as const
    };
    const first = await stageChatFromFile(input, { dataDir, allowedImportRoots: [fixtureDir] });
    const second = await stageChatFromFile(input, { dataDir, allowedImportRoots: [fixtureDir] });
    const overwrite = await stageChatFromFile({ ...input, allowOverwrite: true }, { dataDir, allowedImportRoots: [fixtureDir] });

    expect(first.staged).toHaveLength(1);
    expect(second.staged).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    expect(overwrite.staged).toHaveLength(1);
  });
});
