import { promises as fs } from "node:fs";
import path from "node:path";
import { createEmptyRedactionReport } from "../services/redaction.js";
import { hashText } from "../services/storage.js";
import type { ConversationMessage, ConversationRole, NormalizedConversation, RedactionLevel } from "../types.js";

const ROLE_LINE = /^(user|chris|assistant|chatgpt|codex|system|tool)\s*:\s*(.*)$/i;

function normalizeRole(value: string): ConversationRole {
  const lower = value.toLowerCase();
  if (lower === "chris" || lower === "user") {
    return "user";
  }
  if (lower === "chatgpt" || lower === "codex" || lower === "assistant") {
    return "assistant";
  }
  if (lower === "system") {
    return "system";
  }
  if (lower === "tool") {
    return "tool";
  }
  return "unknown";
}

function extractTitle(markdown: string, sourcePath: string): string {
  const heading = markdown.split(/\r?\n/).find((line) => line.startsWith("# "));
  return heading?.replace(/^#\s+/, "").trim() || path.basename(sourcePath, path.extname(sourcePath));
}

export async function parseMarkdownChatFile(
  sourcePath: string,
  redactionLevel: RedactionLevel,
  tags: string[]
): Promise<NormalizedConversation[]> {
  const markdown = await fs.readFile(sourcePath, "utf8");
  const title = extractTitle(markdown, sourcePath);
  const messages: ConversationMessage[] = [];
  let current: ConversationMessage | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const roleMatch = ROLE_LINE.exec(line);
    if (roleMatch) {
      if (current && current.text.trim()) {
        messages.push(current);
      }
      current = {
        id: `message-${messages.length + 1}`,
        role: normalizeRole(roleMatch[1] ?? ""),
        text: roleMatch[2] ?? ""
      };
      continue;
    }

    if (current) {
      current.text = `${current.text}${current.text ? "\n" : ""}${line}`;
    }
  }

  if (current && current.text.trim()) {
    messages.push(current);
  }

  const finalMessages =
    messages.length > 0
      ? messages
      : [
          {
            id: "message-1",
            role: "unknown" as const,
            text: markdown
          }
        ];

  return [
    {
      id: hashText(`${title}:${markdown}`).slice(0, 16),
      title,
      sourceType: "markdown",
      sourcePath,
      tags,
      messages: finalMessages,
      redaction: createEmptyRedactionReport(redactionLevel)
    }
  ];
}
