import { promises as fs } from "node:fs";
import path from "node:path";
import { createEmptyRedactionReport } from "../services/redaction.js";
import { fromUnixSeconds, hashText } from "../services/storage.js";
import type { ConversationMessage, ConversationRole, NormalizedConversation, RedactionLevel } from "../types.js";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function roleFrom(value: unknown): ConversationRole {
  if (value === "user" || value === "assistant" || value === "system" || value === "tool") {
    return value;
  }
  return "unknown";
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!isObject(content)) {
    return "";
  }

  const parts = content.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (isObject(part)) {
          const text = stringValue(part.text) ?? stringValue(part.name);
          return text ?? JSON.stringify(part);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return stringValue(content.text) ?? stringValue(content.result) ?? "";
}

function messageFromRaw(id: string, rawMessage: JsonObject): ConversationMessage | undefined {
  const author = isObject(rawMessage.author) ? rawMessage.author : {};
  const role = roleFrom(author.role);
  const text = extractContentText(rawMessage.content);
  if (!text.trim()) {
    return undefined;
  }

  return {
    id,
    role,
    text,
    authorName: stringValue(author.name),
    createdAt: fromUnixSeconds(rawMessage.create_time)
  };
}

function messagesFromMapping(mapping: unknown): ConversationMessage[] {
  if (!isObject(mapping)) {
    return [];
  }

  const messages: ConversationMessage[] = [];
  for (const [nodeId, node] of Object.entries(mapping)) {
    if (!isObject(node) || !isObject(node.message)) {
      continue;
    }
    const message = messageFromRaw(nodeId, node.message);
    if (message) {
      messages.push(message);
    }
  }

  return messages.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

function messagesFromArray(messages: unknown): ConversationMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((item, index) => (isObject(item) ? messageFromRaw(stringValue(item.id) ?? `message-${index + 1}`, item) : undefined))
    .filter((item): item is ConversationMessage => Boolean(item));
}

function conversationFromRaw(
  raw: JsonObject,
  sourcePath: string,
  redactionLevel: RedactionLevel,
  tags: string[]
): NormalizedConversation | undefined {
  const title = stringValue(raw.title) ?? path.basename(sourcePath);
  const messages = messagesFromMapping(raw.mapping);
  const fallbackMessages = messages.length > 0 ? messages : messagesFromArray(raw.messages);

  if (fallbackMessages.length === 0) {
    return undefined;
  }

  const idSeed = `${stringValue(raw.id) ?? title}:${fallbackMessages.map((message) => message.text).join("\n")}`;
  return {
    id: stringValue(raw.id) ?? hashText(idSeed).slice(0, 16),
    title,
    sourceType: "chatgpt_conversations_json",
    sourcePath,
    createdAt: fromUnixSeconds(raw.create_time),
    updatedAt: fromUnixSeconds(raw.update_time),
    tags,
    messages: fallbackMessages,
    redaction: createEmptyRedactionReport(redactionLevel)
  };
}

export async function parseChatGptJsonFile(
  sourcePath: string,
  redactionLevel: RedactionLevel,
  tags: string[]
): Promise<NormalizedConversation[]> {
  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const candidates = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.conversations)
      ? parsed.conversations
      : [parsed];

  return candidates
    .map((candidate) => (isObject(candidate) ? conversationFromRaw(candidate, sourcePath, redactionLevel, tags) : undefined))
    .filter((conversation): conversation is NormalizedConversation => Boolean(conversation));
}
