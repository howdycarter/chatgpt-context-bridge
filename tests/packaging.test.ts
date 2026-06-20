import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

async function expectFile(relativePath: string): Promise<void> {
  await expect(access(path.join(root, relativePath))).resolves.toBeUndefined();
}

describe("plugin and skill packaging", () => {
  it("ships a Codex plugin manifest with MCP and skill pointers", async () => {
    const plugin = JSON.parse(await readFile(path.join(root, "plugin", ".codex-plugin", "plugin.json"), "utf8"));
    const mcp = JSON.parse(await readFile(path.join(root, "plugin", ".mcp.json"), "utf8"));

    expect(plugin.name).toBe("chatgpt-context-bridge");
    expect(plugin.skills).toBe("./skills/");
    expect(plugin.mcpServers).toBe("./.mcp.json");
    expect(mcp.mcpServers["chatgpt-context-bridge"].args).toContain("./scripts/context-bridge-mcp.mjs");
    await expectFile("plugin/scripts/context-bridge-mcp.mjs");
  });

  it("ships matching Codex and OpenAI skills for ingest and routing", async () => {
    const skillNames = ["context-bridge-ingest", "context-bridge-routing"];
    for (const skillName of skillNames) {
      await expectFile(`plugin/skills/${skillName}/SKILL.md`);
      await expectFile(`plugin/skills/${skillName}/agents/openai.yaml`);
      await expectFile(`openai-skills/${skillName}/SKILL.md`);
    }
  });
});
