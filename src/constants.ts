export const INDEX_FILENAME = "index.json";
export const AUDIT_LOG_FILENAME = "audit/events.jsonl";
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const FILE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}-/;

export const HOMEBLOCK_FOLDERS = {
  project: "10_ACTIVE_OUTCOMES",
  area: "20_LIFE_AREAS",
  resource: "03_RESOURCES",
  knowledge: "30_KNOWLEDGE_LIBRARY",
  inbox: "00_META/inbox"
} as const;
