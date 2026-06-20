import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { AUDIT_LOG_FILENAME, DEFAULT_MAX_IMPORT_BYTES, INDEX_FILENAME } from "../constants.js";
import type { AuditEvent, BridgeConfig, BridgeIndex } from "../types.js";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function slugify(value: string, fallback = "untitled"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isoDateFrom(value?: string): string {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export function fromUnixSeconds(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return new Date(value * 1000).toISOString();
}

export function getBridgeConfig(overrides: Partial<BridgeConfig> = {}): BridgeConfig {
  const cwd = process.cwd();
  const dataDir = path.resolve(overrides.dataDir ?? process.env.CONTEXT_BRIDGE_DATA_DIR ?? path.join(cwd, "data"));
  const home = os.homedir();
  const envRoots = process.env.CONTEXT_BRIDGE_IMPORT_ROOTS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const defaultRoots = [cwd, dataDir, path.join(home, "Downloads"), path.join(home, "Documents")];
  const allowedImportRoots = (overrides.allowedImportRoots ?? envRoots ?? defaultRoots).map((root) => path.resolve(root));

  return {
    dataDir,
    allowedImportRoots,
    maxImportBytes: overrides.maxImportBytes ?? DEFAULT_MAX_IMPORT_BYTES
  };
}

export async function ensureBridgeDirs(config: BridgeConfig): Promise<void> {
  const dirs = [
    config.dataDir,
    path.join(config.dataDir, "staging"),
    path.join(config.dataDir, "staging", "chats"),
    path.join(config.dataDir, "staging", "manifests"),
    path.join(config.dataDir, "staging", "homebase"),
    path.join(config.dataDir, "staging", "notion"),
    path.join(config.dataDir, "staging", "assets")
  ];
  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
}

function normalizeForCompare(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isPathInside(candidate: string, root: string): boolean {
  const normalizedCandidate = normalizeForCompare(candidate);
  const normalizedRoot = normalizeForCompare(root);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function resolveReadableImportPath(inputPath: string, config: BridgeConfig): Promise<string> {
  const resolved = path.resolve(inputPath);
  const allowed = config.allowedImportRoots.some((root) => isPathInside(resolved, root));
  if (!allowed) {
    throw new Error(
      `Import path is outside allowed roots. Add it to CONTEXT_BRIDGE_IMPORT_ROOTS or move the file under: ${config.allowedImportRoots.join(", ")}`
    );
  }

  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error(`Import path is not a file: ${resolved}`);
  }
  if (stat.size > config.maxImportBytes) {
    throw new Error(`Import file is too large: ${stat.size} bytes exceeds ${config.maxImportBytes}`);
  }
  return resolved;
}

export function resolveWritableDataPath(relativePath: string, config: BridgeConfig): string {
  const resolved = path.resolve(config.dataDir, relativePath);
  if (!isPathInside(resolved, config.dataDir)) {
    throw new Error(`Refusing to write outside bridge data directory: ${relativePath}`);
  }
  return resolved;
}

export async function readIndex(config: BridgeConfig): Promise<BridgeIndex> {
  await ensureBridgeDirs(config);
  const indexPath = resolveWritableDataPath(INDEX_FILENAME, config);
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as BridgeIndex;
    return { version: 1, records: parsed.records ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, records: [] };
    }
    throw error;
  }
}

export async function writeIndex(config: BridgeConfig, index: BridgeIndex): Promise<void> {
  await ensureBridgeDirs(config);
  const indexPath = resolveWritableDataPath(INDEX_FILENAME, config);
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
}

export async function writeJson(relativePath: string, config: BridgeConfig, value: unknown): Promise<string> {
  const fullPath = resolveWritableDataPath(relativePath, config);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fullPath;
}

export async function writeText(relativePath: string, config: BridgeConfig, value: string): Promise<string> {
  const fullPath = resolveWritableDataPath(relativePath, config);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
  return fullPath;
}

export async function appendAuditEvent(config: BridgeConfig, event: Omit<AuditEvent, "id" | "createdAt" | "canonicalWrites" | "reviewRequired">): Promise<string> {
  const createdAt = new Date().toISOString();
  const fullEvent: AuditEvent = {
    id: `${createdAt.slice(0, 10)}-${hashText(`${createdAt}:${event.operation}:${JSON.stringify(event)}`).slice(0, 12)}`,
    createdAt,
    canonicalWrites: false,
    reviewRequired: true,
    ...event
  };
  const auditPath = resolveWritableDataPath(AUDIT_LOG_FILENAME, config);
  await fs.mkdir(path.dirname(auditPath), { recursive: true });
  await fs.appendFile(auditPath, `${JSON.stringify(fullEvent)}\n`, "utf8");
  return auditPath;
}
