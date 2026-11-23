import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { MongoClient } from "mongodb";

const ROOT = resolve(process.env.PC_STORAGE_ROOT ?? "D:\\container\\multi-container-app\\app\\DockerDesktopVMM\\data\\data-center\\data_leaning\\pc_storage");
const URI = process.env.MONGO_STORAGE_URI;
const DB_NAME = process.env.MONGO_STORAGE_DB;
const COLLECTION = process.env.MONGO_STORAGE_SYNC_COLLECTION ?? "pc_storage_metadata";
const MAX_FILES = Number(process.env.PC_STORAGE_SYNC_MAX_FILES ?? 10_000);
const EXCLUDED = new Set([".git", "node_modules", "out_sync", "secrets"]);

type FileMetadata = {
  sourceRoot: string;
  relativePath: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
  metadataHash: string;
  syncedAt: string;
};

function digest(value: Omit<FileMetadata, "metadataHash">): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function walk(directory: string, output: FileMetadata[]): Promise<void> {
  if (output.length >= MAX_FILES) return;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    const relativePath = relative(ROOT, fullPath).replaceAll("\\", "/");
    const info = await stat(fullPath);
    const base = { sourceRoot: ROOT, relativePath, name: basename(fullPath), type: entry.isDirectory() ? "directory" as const : "file" as const, ...(entry.isFile() ? { size: info.size } : {}), modifiedAt: info.mtime.toISOString(), syncedAt: new Date().toISOString() };
    output.push({ ...base, metadataHash: digest(base) });
    if (entry.isDirectory()) await walk(fullPath, output);
    if (output.length >= MAX_FILES) return;
  }
}

export async function syncPcStorageMetadata(): Promise<{ synced: number; collection: string }> {
  if (!URI || !DB_NAME) throw new Error("MongoDB login required: set MONGO_STORAGE_URI and MONGO_STORAGE_DB");
  const documents: FileMetadata[] = [];
  await walk(ROOT, documents);
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  try {
    const collection = client.db(DB_NAME).collection<FileMetadata>(COLLECTION);
    await collection.createIndex({ sourceRoot: 1, relativePath: 1 }, { unique: true });
    for (const document of documents) {
      await collection.updateOne({ sourceRoot: document.sourceRoot, relativePath: document.relativePath }, { $set: document }, { upsert: true });
    }
  } finally {
    await client.close();
  }
  return { synced: documents.length, collection: COLLECTION };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  syncPcStorageMetadata().then((result) => console.log(JSON.stringify(result))).catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}

