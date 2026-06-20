import type { ConversationSummary, NormalizedConversation } from "../types.js";

function compact(value: string, maxLength = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function collectCandidateLines(conversation: NormalizedConversation, pattern: RegExp, limit: number): string[] {
  const results: string[] = [];
  for (const message of conversation.messages) {
    for (const line of message.text.split(/\r?\n/)) {
      if (pattern.test(line) && line.trim().length > 8) {
        results.push(compact(line, 180));
      }
      pattern.lastIndex = 0;
      if (results.length >= limit) {
        return results;
      }
    }
  }
  return results;
}

export function summarizeConversation(conversation: NormalizedConversation): ConversationSummary {
  const roles: Record<string, number> = {};
  for (const message of conversation.messages) {
    roles[message.role] = (roles[message.role] ?? 0) + 1;
  }

  const firstUserAsk = conversation.messages.find((message) => message.role === "user")?.text;
  const keyPoints = conversation.messages
    .filter((message) => message.role === "assistant" || message.role === "user")
    .slice(0, 4)
    .map((message) => `${message.role}: ${compact(message.text)}`);

  const actionCandidates = collectCandidateLines(
    conversation,
    /\b(todo|next|follow up|implement|ship|decide|verify|test|draft|create)\b/i,
    8
  );
  const riskNotes = collectCandidateLines(
    conversation,
    /\b(secret|privacy|credential|token|legal|health|family|financial|approval|blocker|risk)\b/i,
    6
  );

  if (Object.keys(conversation.redaction.replacements).length > 0) {
    riskNotes.unshift(`Redaction applied: ${JSON.stringify(conversation.redaction.replacements)}`);
  }

  return {
    title: conversation.title,
    messageCount: conversation.messages.length,
    roles,
    firstUserAsk: firstUserAsk ? compact(firstUserAsk, 320) : undefined,
    keyPoints,
    actionCandidates,
    riskNotes
  };
}
