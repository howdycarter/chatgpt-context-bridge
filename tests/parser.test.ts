import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseChatGptJsonFile } from "../src/ingest/chatgpt.js";
import { parseMarkdownChatFile } from "../src/ingest/markdown.js";
import { redactConversation } from "../src/services/redaction.js";

const fixtureDir = path.resolve("tests", "fixtures");

describe("conversation parsers", () => {
  it("parses ChatGPT conversations.json and redacts secrets", async () => {
    const parsed = await parseChatGptJsonFile(path.join(fixtureDir, "conversations.json"), "standard", ["test"]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.messages).toHaveLength(2);

    const redacted = redactConversation(parsed[0]!, "standard");
    expect(redacted.messages[0]?.text).toContain("[REDACTED_EMAIL]");
    expect(redacted.messages[0]?.text).toContain("[REDACTED_OPENAI_KEY]");
  });

  it("parses manual markdown role blocks", async () => {
    const parsed = await parseMarkdownChatFile(path.join(fixtureDir, "manual-chat.md"), "standard", ["manual"]);
    expect(parsed[0]?.title).toBe("Manual Chat Capture");
    expect(parsed[0]?.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
  });
});
