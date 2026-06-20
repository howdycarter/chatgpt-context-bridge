import type { NormalizedConversation, RedactionLevel, RedactionReport } from "../types.js";

interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
  levels: RedactionLevel[];
}

const RULES: RedactionRule[] = [
  {
    name: "openai_api_key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: "[REDACTED_OPENAI_KEY]",
    levels: ["standard", "strict"]
  },
  {
    name: "bearer_token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    replacement: "Bearer [REDACTED_TOKEN]",
    levels: ["standard", "strict"]
  },
  {
    name: "private_key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED_PRIVATE_KEY]",
    levels: ["standard", "strict"]
  },
  {
    name: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
    levels: ["standard", "strict"]
  },
  {
    name: "phone",
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
    replacement: "[REDACTED_PHONE]",
    levels: ["standard", "strict"]
  },
  {
    name: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[REDACTED_SSN]",
    levels: ["standard", "strict"]
  },
  {
    name: "street_address",
    pattern: /\b\d{2,6}\s+[A-Za-z0-9 .'-]+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Boulevard|Blvd\.?)\b/gi,
    replacement: "[REDACTED_ADDRESS]",
    levels: ["strict"]
  }
];

export function createEmptyRedactionReport(level: RedactionLevel): RedactionReport {
  return { level, replacements: {} };
}

export function redactText(text: string, level: RedactionLevel): { text: string; report: RedactionReport } {
  const report = createEmptyRedactionReport(level);
  let next = text;

  for (const rule of RULES) {
    if (!rule.levels.includes(level)) {
      continue;
    }

    next = next.replace(rule.pattern, () => {
      report.replacements[rule.name] = (report.replacements[rule.name] ?? 0) + 1;
      return rule.replacement;
    });
  }

  return { text: next, report };
}

export function redactConversation(
  conversation: NormalizedConversation,
  level: RedactionLevel
): NormalizedConversation {
  const aggregate = createEmptyRedactionReport(level);
  const redactAndMerge = (value: string): string => {
    const result = redactText(value, level);
    for (const [key, count] of Object.entries(result.report.replacements)) {
      aggregate.replacements[key] = (aggregate.replacements[key] ?? 0) + count;
    }
    return result.text;
  };

  return {
    ...conversation,
    title: redactAndMerge(conversation.title),
    messages: conversation.messages.map((message) => ({
      ...message,
      text: redactAndMerge(message.text)
    })),
    redaction: aggregate
  };
}
