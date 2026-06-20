import { promises as fs } from "node:fs";
import path from "node:path";
import { CHARACTER_LIMIT } from "../constants.js";
import { parseChatGptJsonFile } from "../ingest/chatgpt.js";
import { parseMarkdownChatFile } from "../ingest/markdown.js";
import { classifyConversation } from "./classifier.js";
import { redactConversation } from "./redaction.js";
import { homebaseFilename, renderHomebaseMarkdown } from "./render.js";
import { summarizeConversation } from "./summary.js";
import {
  ensureBridgeDirs,
  getBridgeConfig,
  hashText,
  isoDateFrom,
  appendAuditEvent,
  readIndex,
  resolveReadableImportPath,
  resolveWritableDataPath,
  slugify,
  toPosixPath,
  writeIndex,
  writeJson,
  writeText
} from "./storage.js";
import type {
  BridgeConfig,
  GeneratedImageAssetRecord,
  HomebaseDraftResult,
  ImageAssetRecord,
  NormalizedConversation,
  NotionDraftResult,
  SearchContextResult,
  StageChatInput,
  StageChatResult,
  StagedConversationRecord
} from "../types.js";

function detectSourceType(sourcePath: string, requested: StageChatInput["sourceType"]): Exclude<StageChatInput["sourceType"], "auto"> {
  if (requested !== "auto") {
    return requested === "chatgpt_export_json" ? "chatgpt_conversations_json" : requested;
  }
  const ext = path.extname(sourcePath).toLowerCase();
  return ext === ".json" ? "chatgpt_conversations_json" : "markdown";
}

async function parseSourceFile(input: StageChatInput, config: BridgeConfig): Promise<NormalizedConversation[]> {
  const sourcePath = await resolveReadableImportPath(input.sourcePath, config);
  const sourceType = detectSourceType(sourcePath, input.sourceType);
  if (sourceType === "markdown") {
    return parseMarkdownChatFile(sourcePath, input.redactionLevel, input.tags);
  }
  return parseChatGptJsonFile(sourcePath, input.redactionLevel, input.tags);
}

function buildRecord(
  conversation: NormalizedConversation,
  sourceHash: string,
  config: BridgeConfig
): { record: StagedConversationRecord; conversationRelativePath: string; manifestRelativePath: string } {
  const summary = summarizeConversation(conversation);
  const classification = classifyConversation(conversation);
  const date = isoDateFrom(conversation.updatedAt ?? conversation.createdAt);
  const recordHash = hashText(`${sourceHash}:${conversation.id}:${conversation.title}`).slice(0, 10);
  const id = `${date}-${slugify(conversation.title, "conversation")}-${recordHash}`;
  const conversationRelativePath = toPosixPath(path.join("staging", "chats", `${id}.json`));
  const manifestRelativePath = toPosixPath(path.join("staging", "manifests", `${id}.manifest.json`));

  return {
    conversationRelativePath,
    manifestRelativePath,
    record: {
      id,
      title: conversation.title,
      sourceType: conversation.sourceType,
      sourcePath: conversation.sourcePath,
      sourceHash,
      conversationPath: resolveWritableDataPath(conversationRelativePath, config),
      manifestPath: resolveWritableDataPath(manifestRelativePath, config),
      createdAt: conversation.createdAt ?? new Date().toISOString(),
      updatedAt: conversation.updatedAt,
      tags: conversation.tags,
      summary,
      classification,
      drafts: {}
    }
  };
}

export async function stageChatFromFile(
  input: StageChatInput,
  overrides: Partial<BridgeConfig> = {}
): Promise<StageChatResult> {
  const config = getBridgeConfig(overrides);
  await ensureBridgeDirs(config);
  const resolvedSourcePath = await resolveReadableImportPath(input.sourcePath, config);
  const rawSource = await fs.readFile(resolvedSourcePath, "utf8");
  const sourceHash = hashText(rawSource);
  const parsed = await parseSourceFile({ ...input, sourcePath: resolvedSourcePath }, config);
  const sanitized = parsed.map((conversation) => redactConversation(conversation, input.redactionLevel));
  const index = await readIndex(config);
  const staged: StagedConversationRecord[] = [];
  const skipped: StagedConversationRecord[] = [];

  for (const conversation of sanitized) {
    const built = buildRecord(conversation, sourceHash, config);
    const existing = index.records.find((record) => record.id === built.record.id);
    if (existing && !input.allowOverwrite) {
      skipped.push(existing);
      continue;
    }

    await writeJson(built.conversationRelativePath, config, conversation);
    await writeJson(built.manifestRelativePath, config, {
      record: built.record,
      safety: {
        canonicalWrites: false,
        reviewRequired: true,
        approvalGate: "Human review is required before any Homebase canonical write or Notion mutation.",
        redaction: conversation.redaction
      }
    });

    const existingIndex = index.records.findIndex((record) => record.id === built.record.id);
    if (existingIndex >= 0) {
      index.records[existingIndex] = built.record;
    } else {
      index.records.push(built.record);
    }
    staged.push(built.record);
  }

  index.records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await writeIndex(config, index);
  if (staged.length > 0) {
    await appendAuditEvent(config, {
      operation: "stage_chat",
      stagedChatIds: staged.map((record) => record.id),
      outputPaths: staged.flatMap((record) => [record.conversationPath, record.manifestPath]),
      sourceHash,
      details: {
        sourceType: input.sourceType,
        stagedCount: staged.length,
        skippedCount: skipped.length,
        redactionLevel: input.redactionLevel
      }
    });
  }
  return { dataDir: config.dataDir, staged, skipped };
}

export async function loadStagedConversation(
  stagedChatId: string,
  overrides: Partial<BridgeConfig> = {}
): Promise<{ record: StagedConversationRecord; conversation: NormalizedConversation; config: BridgeConfig }> {
  const config = getBridgeConfig(overrides);
  const index = await readIndex(config);
  const record = index.records.find((item) => item.id === stagedChatId);
  if (!record) {
    throw new Error(`No staged chat found with id '${stagedChatId}'. Use search_context first.`);
  }
  const raw = await fs.readFile(record.conversationPath, "utf8");
  return { record, conversation: JSON.parse(raw) as NormalizedConversation, config };
}

export async function summarizeStagedThread(
  stagedChatId: string,
  overrides: Partial<BridgeConfig> = {}
): Promise<StagedConversationRecord["summary"]> {
  const { record } = await loadStagedConversation(stagedChatId, overrides);
  return record.summary;
}

export async function searchContext(
  query: string,
  limit: number,
  offset: number,
  overrides: Partial<BridgeConfig> = {}
): Promise<SearchContextResult> {
  const config = getBridgeConfig(overrides);
  const index = await readIndex(config);
  const normalizedQuery = query.trim().toLowerCase();
  const records = normalizedQuery
    ? index.records.filter((record) => {
        const haystack = `${record.id}\n${record.title}\n${record.tags.join(" ")}\n${record.summary.keyPoints.join("\n")}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : index.records;
  const page = records.slice(offset, offset + limit);
  return {
    total: records.length,
    count: page.length,
    offset,
    hasMore: offset + page.length < records.length,
    nextOffset: offset + page.length < records.length ? offset + page.length : undefined,
    records: page
  };
}

export async function proposeHomebaseNote(
  stagedChatId: string,
  overrides: Partial<BridgeConfig> = {}
): Promise<HomebaseDraftResult> {
  const { record, conversation, config } = await loadStagedConversation(stagedChatId, overrides);
  const filename = homebaseFilename(record);
  const suggestedCanonicalPath = toPosixPath(path.join(record.classification.suggestedHomebaseFolder, filename));
  const draftRelativePath = toPosixPath(path.join("staging", "homebase", suggestedCanonicalPath));
  const markdown = renderHomebaseMarkdown(record, conversation, suggestedCanonicalPath);
  const draftPath = await writeText(draftRelativePath, config, markdown);
  await updateRecordDraft(stagedChatId, { homebase: draftPath }, config);
  await appendAuditEvent(config, {
    operation: "propose_homebase_note",
    stagedChatIds: [stagedChatId],
    outputPaths: [draftPath],
    details: {
      suggestedCanonicalPath,
      approvalGate: "Draft path is not canonical. Human review is required before moving into Homebase."
    }
  });

  return {
    stagedChatId,
    draftPath,
    suggestedCanonicalPath,
    title: record.title
  };
}

export async function proposeNotionPage(
  stagedChatId: string,
  overrides: Partial<BridgeConfig> = {}
): Promise<NotionDraftResult> {
  const { record, config } = await loadStagedConversation(stagedChatId, overrides);
  const payload: NotionDraftResult["payload"] = {
    title: record.title,
    parentHint: record.classification.suggestedNotionParent,
    verificationRequired: [
      "Review payload manually before Notion mutation.",
      "Use direct page fetch ancestry after any future move or write.",
      "Do not treat Notion search snippets as completion proof."
    ],
    blocks: [
      { type: "heading_1", text: record.title },
      { type: "paragraph", text: `Staged chat ID: ${record.id}` },
      { type: "heading_2", text: "Summary" },
      { type: "paragraph", text: record.summary.firstUserAsk ?? "No first ask detected." },
      { type: "heading_2", text: "Key Points" },
      ...record.summary.keyPoints.map((point) => ({ type: "bulleted_list_item" as const, text: point })),
      { type: "heading_2", text: "Risk Notes" },
      ...record.summary.riskNotes.map((note) => ({ type: "bulleted_list_item" as const, text: note }))
    ]
  };
  const draftRelativePath = toPosixPath(path.join("staging", "notion", `${record.id}.notion-draft.json`));
  const draftPath = await writeJson(draftRelativePath, config, payload);
  await updateRecordDraft(stagedChatId, { notion: draftPath }, config);
  await appendAuditEvent(config, {
    operation: "propose_notion_page",
    stagedChatIds: [stagedChatId],
    outputPaths: [draftPath],
    details: {
      parentHint: payload.parentHint,
      approvalGate: "Payload is not sent to Notion. Human review and direct-fetch verification are required for future writes."
    }
  });

  return { stagedChatId, draftPath, payload };
}

async function updateRecordDraft(
  stagedChatId: string,
  drafts: Partial<StagedConversationRecord["drafts"]>,
  config: BridgeConfig
): Promise<void> {
  const index = await readIndex(config);
  const position = index.records.findIndex((record) => record.id === stagedChatId);
  if (position < 0) {
    throw new Error(`No staged chat found with id '${stagedChatId}'.`);
  }
  index.records[position] = {
    ...index.records[position],
    drafts: {
      ...index.records[position].drafts,
      ...drafts
    }
  };
  await writeIndex(config, index);
}

export async function registerImageAsset(
  input: {
    source: string;
    sourceKind: "local_file" | "url";
    prompt?: string;
    sourceChatId?: string;
    usageRightsNote?: string;
    suggestedHomebaseFolder?: string;
  },
  overrides: Partial<BridgeConfig> = {}
): Promise<ImageAssetRecord> {
  const config = getBridgeConfig(overrides);
  await ensureBridgeDirs(config);
  const id = `${new Date().toISOString().slice(0, 10)}-${hashText(`${input.source}:${input.prompt ?? ""}`).slice(0, 12)}`;
  let storedPath: string | undefined;

  if (input.sourceKind === "local_file") {
    const readablePath = await resolveReadableImportPath(input.source, config);
    const ext = path.extname(readablePath).slice(0, 12) || ".asset";
    const assetRelativePath = toPosixPath(path.join("staging", "assets", `${id}${ext}`));
    storedPath = resolveWritableDataPath(assetRelativePath, config);
    await fs.copyFile(readablePath, storedPath);
  } else if (!/^https?:\/\//i.test(input.source)) {
    throw new Error("URL image assets must start with http:// or https://.");
  }

  const record: ImageAssetRecord = {
    id,
    sourceKind: input.sourceKind,
    source: input.source,
    storedPath,
    prompt: input.prompt,
    sourceChatId: input.sourceChatId,
    usageRightsNote: input.usageRightsNote ?? "Usage rights not reviewed. Keep staged until ownership and publication rights are confirmed.",
    suggestedHomebaseFolder: input.suggestedHomebaseFolder ?? "03_RESOURCES/Media",
    createdAt: new Date().toISOString()
  };
  const manifestPath = await writeJson(toPosixPath(path.join("staging", "assets", `${id}.manifest.json`)), config, record);
  await appendAuditEvent(config, {
    operation: "register_image_asset",
    stagedChatIds: input.sourceChatId ? [input.sourceChatId] : undefined,
    outputPaths: [manifestPath, storedPath].filter((item): item is string => Boolean(item)),
    details: {
      sourceKind: input.sourceKind,
      suggestedHomebaseFolder: record.suggestedHomebaseFolder,
      approvalGate: "Image asset is staged only. Usage rights and publication approval remain required."
    }
  });
  return record;
}

interface GenerateImageAssetInput {
  prompt: string;
  model?: string;
  size?: string;
  quality?: "auto" | "low" | "medium" | "high";
  outputFormat?: "png" | "jpeg" | "webp";
  background?: "auto" | "opaque" | "transparent";
  moderation?: "auto" | "low";
  sourceChatId?: string;
  usageRightsNote?: string;
  suggestedHomebaseFolder?: string;
}

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
}

function requireOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to generate images. The bridge can still register existing image assets without it.");
  }
  return apiKey;
}

export async function generateImageAsset(
  input: GenerateImageAssetInput,
  overrides: Partial<BridgeConfig> = {}
): Promise<GeneratedImageAssetRecord> {
  const config = getBridgeConfig(overrides);
  await ensureBridgeDirs(config);
  const apiKey = requireOpenAiApiKey();
  const model = input.model ?? "gpt-image-1.5";
  const outputFormat = input.outputFormat ?? "png";
  const size = input.size ?? "1024x1024";
  const id = `${new Date().toISOString().slice(0, 10)}-${hashText(`${model}:${size}:${input.prompt}`).slice(0, 12)}`;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      n: 1,
      size,
      quality: input.quality ?? "auto",
      output_format: outputFormat,
      background: input.background ?? "auto",
      moderation: input.moderation ?? "auto"
    })
  });

  const payload = (await response.json()) as OpenAIImageGenerationResponse;
  if (!response.ok) {
    throw new Error(`OpenAI image generation failed: ${payload.error?.message ?? response.statusText}`);
  }

  const image = payload.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenAI image generation response did not include base64 image data.");
  }

  const extension = outputFormat === "jpeg" ? "jpg" : outputFormat;
  const assetRelativePath = toPosixPath(path.join("staging", "assets", `${id}.${extension}`));
  const storedPath = resolveWritableDataPath(assetRelativePath, config);
  await fs.mkdir(path.dirname(storedPath), { recursive: true });
  await fs.writeFile(storedPath, Buffer.from(image.b64_json, "base64"));

  const record: GeneratedImageAssetRecord = {
    id,
    sourceKind: "local_file",
    source: storedPath,
    storedPath,
    prompt: input.prompt,
    sourceChatId: input.sourceChatId,
    usageRightsNote: input.usageRightsNote ?? "Generated image is staged only. Review usage rights and publication context before sharing.",
    suggestedHomebaseFolder: input.suggestedHomebaseFolder ?? "03_RESOURCES/Media",
    createdAt: new Date().toISOString(),
    generated: true,
    model,
    size,
    outputFormat,
    revisedPrompt: image.revised_prompt
  };
  const manifestPath = await writeJson(toPosixPath(path.join("staging", "assets", `${id}.manifest.json`)), config, record);
  await appendAuditEvent(config, {
    operation: "generate_image_asset",
    stagedChatIds: input.sourceChatId ? [input.sourceChatId] : undefined,
    outputPaths: [storedPath, manifestPath],
    details: {
      model,
      size,
      outputFormat,
      suggestedHomebaseFolder: record.suggestedHomebaseFolder,
      approvalGate: "Generated image is staged only. Usage rights and publication approval remain required."
    }
  });

  return record;
}

export function truncateForTool(text: string): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }
  return `${text.slice(0, CHARACTER_LIMIT - 120)}\n\n[Truncated. Narrow the query or request JSON for full structured content.]`;
}
