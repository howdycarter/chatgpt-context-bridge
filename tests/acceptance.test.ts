import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { proposeHomebaseNote, proposeNotionPage, stageChatFromFile } from "../src/services/staging.js";

let dataDir = "";
const fixtureDir = path.resolve("tests", "fixtures");

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "context-bridge-acceptance-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("acceptance", () => {
  it("turns one selected chat into staged Homebase markdown and Notion draft payload", async () => {
    const staged = await stageChatFromFile(
      {
        sourcePath: path.join(fixtureDir, "manual-chat.md"),
        sourceType: "markdown",
        tags: ["image-generation", "homebase"],
        allowOverwrite: false,
        redactionLevel: "standard"
      },
      { dataDir, allowedImportRoots: [fixtureDir] }
    );
    const id = staged.staged[0]!.id;
    const homebase = await proposeHomebaseNote(id, { dataDir, allowedImportRoots: [fixtureDir] });
    const notion = await proposeNotionPage(id, { dataDir, allowedImportRoots: [fixtureDir] });

    expect(homebase.draftPath.startsWith(dataDir)).toBe(true);
    expect(notion.draftPath.startsWith(dataDir)).toBe(true);
    expect(await readFile(homebase.draftPath, "utf8")).toContain("draft only, requires review approval");
    expect(notion.payload.verificationRequired).toContain("Review payload manually before Notion mutation.");
  });
});
