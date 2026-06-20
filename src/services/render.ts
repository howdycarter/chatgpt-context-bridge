import { FILE_DATE_REGEX } from "../constants.js";
import { isoDateFrom, slugify } from "./storage.js";
import type { NormalizedConversation, StagedConversationRecord } from "../types.js";

export function homebaseFilename(record: StagedConversationRecord): string {
  const date = isoDateFrom(record.updatedAt ?? record.createdAt);
  const slug = slugify(record.title, "conversation");
  const filename = `${date}-${slug}.md`;
  return FILE_DATE_REGEX.test(filename) ? filename : `${date}-${filename}`;
}

export function renderHomebaseMarkdown(
  record: StagedConversationRecord,
  conversation: NormalizedConversation,
  suggestedCanonicalPath: string
): string {
  const summary = record.summary;
  const messages = conversation.messages
    .map((message) => {
      const role = message.role.toUpperCase();
      return `### ${role}${message.createdAt ? ` - ${message.createdAt}` : ""}\n\n${message.text}`;
    })
    .join("\n\n");

  return [
    `# ${record.title}`,
    "",
    `- Source staged ID: ${record.id}`,
    `- Suggested Homebase path: ${suggestedCanonicalPath}`,
    `- Routing confidence: ${record.classification.confidence.toFixed(2)}`,
    `- Canonical-write status: draft only, requires review approval`,
    "",
    "## Summary",
    "",
    summary.firstUserAsk ? `First ask: ${summary.firstUserAsk}` : "First ask: Not detected.",
    "",
    "## Key Points",
    "",
    ...(summary.keyPoints.length ? summary.keyPoints.map((point) => `- ${point}`) : ["- No key points detected."]),
    "",
    "## Action Candidates",
    "",
    ...(summary.actionCandidates.length
      ? summary.actionCandidates.map((item) => `- ${item}`)
      : ["- No action candidates detected."]),
    "",
    "## Risk Notes",
    "",
    ...(summary.riskNotes.length ? summary.riskNotes.map((item) => `- ${item}`) : ["- No risk notes detected."]),
    "",
    "## Conversation",
    "",
    messages
  ].join("\n");
}

export function renderMarkdownList(title: string, lines: string[]): string {
  return [`# ${title}`, "", ...lines].join("\n");
}
