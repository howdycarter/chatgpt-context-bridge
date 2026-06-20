import { z } from "zod";
import {
  proposeHomebaseNote,
  proposeNotionPage,
  generateImageAsset,
  registerImageAsset,
  searchContext,
  stageChatFromFile,
  summarizeStagedThread,
  truncateForTool
} from "../services/staging.js";
import type { ResponseFormat, StageChatInput } from "../types.js";

export const ResponseFormatSchema = z.enum(["markdown", "json"]).default("markdown");

function formatResult(title: string, data: unknown, responseFormat: ResponseFormat): string {
  if (responseFormat === "json") {
    return JSON.stringify(data, null, 2);
  }

  if (Array.isArray(data)) {
    return truncateForTool([`# ${title}`, "", ...data.map((item) => `- ${String(item)}`)].join("\n"));
  }

  if (typeof data === "object" && data !== null) {
    return truncateForTool([`# ${title}`, "", "```json", JSON.stringify(data, null, 2), "```"].join("\n"));
  }

  return truncateForTool([`# ${title}`, "", String(data)].join("\n"));
}

function toStructuredContent(data: unknown): Record<string, unknown> {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { result: data };
}

export function toolResponse(title: string, data: unknown, responseFormat: ResponseFormat) {
  return {
    content: [{ type: "text" as const, text: formatResult(title, data, responseFormat) }],
    structuredContent: toStructuredContent(data)
  };
}

export const SearchContextInputShape = {
  query: z.string().max(500).default("").describe("Search staged chat titles, tags, and summaries."),
  limit: z.number().int().min(1).max(50).default(20).describe("Maximum staged records to return."),
  offset: z.number().int().min(0).default(0).describe("Number of matching records to skip."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const SearchContextInputSchema = z.object(SearchContextInputShape).strict();

export async function handleSearchContext(rawParams: unknown) {
  const params = SearchContextInputSchema.parse(rawParams);
  const result = await searchContext(params.query, params.limit, params.offset);
  return toolResponse("Context Bridge Search Results", result, params.response_format);
}

export const StageChatInputShape = {
  source_path: z.string().min(1).describe("Path to a ChatGPT conversations.json export or manual markdown chat file."),
  source_type: z
    .enum(["auto", "chatgpt_export_json", "chatgpt_conversations_json", "markdown"])
    .default("auto")
    .describe("Parser to use. auto chooses JSON or markdown from file extension."),
  tags: z.array(z.string().min(1).max(64)).default([]).describe("Private routing tags to attach to staged records."),
  allow_overwrite: z.boolean().default(false).describe("Whether to overwrite an existing staged record with the same source hash."),
  redaction_level: z.enum(["standard", "strict"]).default("standard").describe("standard redacts secrets/contact data; strict also redacts street addresses."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const StageChatInputSchema = z.object(StageChatInputShape).strict();

export async function handleStageChat(rawParams: unknown) {
  const params = StageChatInputSchema.parse(rawParams);
  const input: StageChatInput = {
    sourcePath: params.source_path,
    sourceType: params.source_type,
    tags: params.tags,
    allowOverwrite: params.allow_overwrite,
    redactionLevel: params.redaction_level
  };
  const result = await stageChatFromFile(input);
  return toolResponse("Context Bridge Stage Chat", result, params.response_format);
}

export const SummarizeThreadInputShape = {
  staged_chat_id: z.string().min(1).describe("ID returned by stage_chat or search_context."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const SummarizeThreadInputSchema = z.object(SummarizeThreadInputShape).strict();

export async function handleSummarizeThread(rawParams: unknown) {
  const params = SummarizeThreadInputSchema.parse(rawParams);
  const result = await summarizeStagedThread(params.staged_chat_id);
  return toolResponse("Context Bridge Thread Summary", result, params.response_format);
}

export const ProposeHomebaseInputShape = {
  staged_chat_id: z.string().min(1).describe("ID returned by stage_chat or search_context."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const ProposeHomebaseInputSchema = z.object(ProposeHomebaseInputShape).strict();

export async function handleProposeHomebaseNote(rawParams: unknown) {
  const params = ProposeHomebaseInputSchema.parse(rawParams);
  const result = await proposeHomebaseNote(params.staged_chat_id);
  return toolResponse("Context Bridge Homebase Draft", result, params.response_format);
}

export const ProposeNotionInputShape = {
  staged_chat_id: z.string().min(1).describe("ID returned by stage_chat or search_context."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const ProposeNotionInputSchema = z.object(ProposeNotionInputShape).strict();

export async function handleProposeNotionPage(rawParams: unknown) {
  const params = ProposeNotionInputSchema.parse(rawParams);
  const result = await proposeNotionPage(params.staged_chat_id);
  return toolResponse("Context Bridge Notion Draft", result, params.response_format);
}

export const RegisterImageAssetInputShape = {
  source: z.string().min(1).describe("Local image path or http(s) URL."),
  source_kind: z.enum(["local_file", "url"]).describe("Whether source is a local file or URL."),
  prompt: z.string().max(6000).optional().describe("Prompt or generation context for the image."),
  source_chat_id: z.string().optional().describe("Optional staged chat ID associated with the image."),
  usage_rights_note: z.string().max(1000).optional().describe("Usage rights or publication review note."),
  suggested_homebase_folder: z.string().max(240).optional().describe("Suggested Homebase media folder."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const RegisterImageAssetInputSchema = z.object(RegisterImageAssetInputShape).strict();

export async function handleRegisterImageAsset(rawParams: unknown) {
  const params = RegisterImageAssetInputSchema.parse(rawParams);
  const result = await registerImageAsset({
    source: params.source,
    sourceKind: params.source_kind,
    prompt: params.prompt,
    sourceChatId: params.source_chat_id,
    usageRightsNote: params.usage_rights_note,
    suggestedHomebaseFolder: params.suggested_homebase_folder
  });
  return toolResponse("Context Bridge Image Asset", result, params.response_format);
}

export const GenerateImageAssetInputShape = {
  prompt: z.string().min(1).max(32000).describe("Text prompt for OpenAI image generation."),
  model: z
    .enum(["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"])
    .default("gpt-image-1.5")
    .describe("OpenAI GPT image model to use."),
  size: z
    .enum(["1024x1024", "1536x1024", "1024x1536", "auto"])
    .default("1024x1024")
    .describe("Generated image size."),
  quality: z.enum(["auto", "low", "medium", "high"]).default("auto").describe("Generated image quality."),
  output_format: z.enum(["png", "jpeg", "webp"]).default("png").describe("File format to save in staging."),
  background: z.enum(["auto", "opaque", "transparent"]).default("auto").describe("Background handling for supported formats."),
  moderation: z.enum(["auto", "low"]).default("auto").describe("Content moderation level for GPT image models."),
  source_chat_id: z.string().optional().describe("Optional staged chat ID associated with the generated image."),
  usage_rights_note: z.string().max(1000).optional().describe("Usage rights or publication review note."),
  suggested_homebase_folder: z.string().max(240).optional().describe("Suggested Homebase media folder."),
  response_format: ResponseFormatSchema.describe("Output format: markdown or json.")
};
const GenerateImageAssetInputSchema = z.object(GenerateImageAssetInputShape).strict();

export async function handleGenerateImageAsset(rawParams: unknown) {
  const params = GenerateImageAssetInputSchema.parse(rawParams);
  const result = await generateImageAsset({
    prompt: params.prompt,
    model: params.model,
    size: params.size,
    quality: params.quality,
    outputFormat: params.output_format,
    background: params.background,
    moderation: params.moderation,
    sourceChatId: params.source_chat_id,
    usageRightsNote: params.usage_rights_note,
    suggestedHomebaseFolder: params.suggested_homebase_folder
  });
  return toolResponse("Context Bridge Generated Image Asset", result, params.response_format);
}
