import { HOMEBLOCK_FOLDERS } from "../constants.js";
import type { ClassificationResult, DestinationKind, NormalizedConversation } from "../types.js";

const KEYWORDS: Record<DestinationKind, string[]> = {
  project: ["build", "implement", "ship", "launch", "milestone", "deliverable", "project", "roadmap"],
  area: ["routine", "ongoing", "responsibility", "health", "family", "finance", "operations", "maintenance"],
  resource: ["reference", "guide", "research", "source", "pattern", "framework", "example"],
  knowledge: ["principle", "lesson", "insight", "mental model", "strategy", "decision"],
  inbox: []
};

function scoreText(text: string, words: string[]): number {
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

export function classifyConversation(conversation: NormalizedConversation): ClassificationResult {
  const text = `${conversation.title}\n${conversation.tags.join(" ")}\n${conversation.messages
    .slice(0, 20)
    .map((message) => message.text)
    .join("\n")}`.toLowerCase();

  const scores = Object.entries(KEYWORDS).map(([destination, words]) => ({
    destination: destination as DestinationKind,
    score: scoreText(text, words)
  }));
  const best = scores.sort((a, b) => b.score - a.score)[0] ?? { destination: "inbox" as const, score: 0 };
  const destination = best.score > 0 ? best.destination : "inbox";

  const reasons =
    destination === "inbox"
      ? ["No strong routing keywords found; keep as a review draft."]
      : [`Matched ${destination} routing keywords in title, tags, or early messages.`];

  return {
    destination,
    suggestedHomebaseFolder: HOMEBLOCK_FOLDERS[destination],
    suggestedNotionParent: destination === "inbox" ? "Homebase - Personal OS / Inbox Review" : "Homebase - Personal OS",
    confidence: Math.min(0.95, 0.45 + best.score * 0.15),
    reasons
  };
}
