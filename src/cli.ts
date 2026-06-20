#!/usr/bin/env node
import {
  proposeHomebaseNote,
  proposeNotionPage,
  generateImageAsset,
  registerImageAsset,
  searchContext,
  stageChatFromFile,
  summarizeStagedThread
} from "./services/staging.js";
import type { SourceType } from "./types.js";

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, flags };
}

function stringFlag(flags: Record<string, string | boolean>, key: string, fallback = ""): string {
  const value = flags[key];
  return typeof value === "string" ? value : fallback;
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (command === "stage") {
    const result = await stageChatFromFile({
      sourcePath: stringFlag(flags, "source"),
      sourceType: stringFlag(flags, "source-type", "auto") as SourceType,
      tags: stringFlag(flags, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      allowOverwrite: Boolean(flags["allow-overwrite"]),
      redactionLevel: stringFlag(flags, "redaction-level", "standard") === "strict" ? "strict" : "standard"
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "search") {
    const result = await searchContext(stringFlag(flags, "query"), Number(stringFlag(flags, "limit", "20")), 0);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "summary") {
    const result = await summarizeStagedThread(stringFlag(flags, "id"));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "homebase") {
    const result = await proposeHomebaseNote(stringFlag(flags, "id"));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "notion") {
    const result = await proposeNotionPage(stringFlag(flags, "id"));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "image") {
    const result = await registerImageAsset({
      source: stringFlag(flags, "source"),
      sourceKind: stringFlag(flags, "source-kind", "local_file") === "url" ? "url" : "local_file",
      prompt: stringFlag(flags, "prompt") || undefined,
      sourceChatId: stringFlag(flags, "chat-id") || undefined,
      usageRightsNote: stringFlag(flags, "usage-rights-note") || undefined,
      suggestedHomebaseFolder: stringFlag(flags, "folder") || undefined
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "generate-image") {
    const result = await generateImageAsset({
      prompt: stringFlag(flags, "prompt"),
      model: stringFlag(flags, "model", "gpt-image-1.5"),
      size: stringFlag(flags, "size", "1024x1024"),
      quality: ["low", "medium", "high"].includes(stringFlag(flags, "quality"))
        ? (stringFlag(flags, "quality") as "low" | "medium" | "high")
        : "auto",
      outputFormat: ["jpeg", "webp"].includes(stringFlag(flags, "format"))
        ? (stringFlag(flags, "format") as "jpeg" | "webp")
        : "png",
      sourceChatId: stringFlag(flags, "chat-id") || undefined,
      usageRightsNote: stringFlag(flags, "usage-rights-note") || undefined,
      suggestedHomebaseFolder: stringFlag(flags, "folder") || undefined
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    [
      "Context Bridge CLI",
      "",
      "Commands:",
      "  stage --source <file> [--tags a,b] [--source-type auto|markdown|chatgpt_conversations_json]",
      "  search --query <text> [--limit 20]",
      "  summary --id <staged-chat-id>",
      "  homebase --id <staged-chat-id>",
      "  notion --id <staged-chat-id>",
      "  image --source <file-or-url> [--source-kind local_file|url] [--chat-id <staged-chat-id>]",
      "  generate-image --prompt <prompt> [--size 1024x1024] [--format png|jpeg|webp]"
    ].join("\n")
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
