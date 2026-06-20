export type ConversationRole = "user" | "assistant" | "system" | "tool" | "unknown";
export type SourceType = "auto" | "chatgpt_export_json" | "chatgpt_conversations_json" | "markdown";
export type ResponseFormat = "markdown" | "json";
export type RedactionLevel = "standard" | "strict";
export type DestinationKind = "project" | "area" | "resource" | "knowledge" | "inbox";

export interface RedactionReport {
  level: RedactionLevel;
  replacements: Record<string, number>;
}

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  text: string;
  authorName?: string;
  createdAt?: string;
}

export interface NormalizedConversation {
  id: string;
  title: string;
  sourceType: Exclude<SourceType, "auto">;
  sourcePath?: string;
  createdAt?: string;
  updatedAt?: string;
  tags: string[];
  messages: ConversationMessage[];
  redaction: RedactionReport;
}

export interface ConversationSummary {
  title: string;
  messageCount: number;
  roles: Record<string, number>;
  firstUserAsk?: string;
  keyPoints: string[];
  actionCandidates: string[];
  riskNotes: string[];
}

export interface ClassificationResult {
  destination: DestinationKind;
  suggestedHomebaseFolder: string;
  suggestedNotionParent: string;
  confidence: number;
  reasons: string[];
}

export interface StagedDrafts {
  homebase?: string;
  notion?: string;
}

export interface StagedConversationRecord {
  id: string;
  title: string;
  sourceType: NormalizedConversation["sourceType"];
  sourcePath?: string;
  sourceHash: string;
  conversationPath: string;
  manifestPath: string;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  summary: ConversationSummary;
  classification: ClassificationResult;
  drafts: StagedDrafts;
}

export interface BridgeIndex {
  version: 1;
  records: StagedConversationRecord[];
}

export interface BridgeConfig {
  dataDir: string;
  allowedImportRoots: string[];
  maxImportBytes: number;
}

export type AuditOperation =
  | "stage_chat"
  | "propose_homebase_note"
  | "propose_notion_page"
  | "register_image_asset"
  | "generate_image_asset";

export interface AuditEvent {
  id: string;
  operation: AuditOperation;
  createdAt: string;
  canonicalWrites: false;
  reviewRequired: true;
  stagedChatIds?: string[];
  outputPaths?: string[];
  sourceHash?: string;
  details?: Record<string, unknown>;
}

export interface StageChatInput {
  sourcePath: string;
  sourceType: SourceType;
  tags: string[];
  allowOverwrite: boolean;
  redactionLevel: RedactionLevel;
}

export interface StageChatResult {
  dataDir: string;
  staged: StagedConversationRecord[];
  skipped: StagedConversationRecord[];
}

export interface SearchContextResult {
  total: number;
  count: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  records: StagedConversationRecord[];
}

export interface HomebaseDraftResult {
  stagedChatId: string;
  draftPath: string;
  suggestedCanonicalPath: string;
  title: string;
}

export interface NotionDraftResult {
  stagedChatId: string;
  draftPath: string;
  payload: {
    title: string;
    parentHint: string;
    verificationRequired: string[];
    blocks: Array<{ type: "heading_1" | "heading_2" | "paragraph" | "bulleted_list_item"; text: string }>;
  };
}

export interface ImageAssetRecord {
  id: string;
  sourceKind: "local_file" | "url";
  source: string;
  storedPath?: string;
  prompt?: string;
  sourceChatId?: string;
  usageRightsNote: string;
  suggestedHomebaseFolder: string;
  createdAt: string;
}

export interface GeneratedImageAssetRecord extends ImageAssetRecord {
  sourceKind: "local_file";
  generated: true;
  model: string;
  size: string;
  outputFormat: "png" | "jpeg" | "webp";
  revisedPrompt?: string;
}
