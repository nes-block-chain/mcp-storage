import { MongoClient, type Db, type Document } from "mongodb";

const SECRET_FIELDS = new Set(["password", "token", "access_token", "refresh_token", "client_secret", "private_key", "privateKey", "apiKey", "secret"]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELDS.has(key) || SECRET_FIELDS.has(key.toLowerCase())) continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}

export type MongoStorageOptions = {
  uri?: string;
  database?: string;
  allowedCollections?: string[];
  connectTimeoutMs?: number;
};

export class MongoStorageClient {
  private client?: MongoClient;
  private db?: Db;
  private readonly options: Required<Pick<MongoStorageOptions, "allowedCollections" | "connectTimeoutMs">> & Omit<MongoStorageOptions, "allowedCollections" | "connectTimeoutMs">;

  constructor(options: MongoStorageOptions = {}) {
    this.options = {
      uri: options.uri ?? process.env.MONGO_STORAGE_URI,
      database: options.database ?? process.env.MONGO_STORAGE_DB,
      allowedCollections: options.allowedCollections ?? (process.env.MONGO_STORAGE_COLLECTIONS ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      connectTimeoutMs: options.connectTimeoutMs ?? 10_000
    };
  }

  async connect(): Promise<void> {
    if (this.db) return;
    if (!this.options.uri || !this.options.database) throw new Error("MongoDB login required: set MONGO_STORAGE_URI and MONGO_STORAGE_DB");
    this.client = new MongoClient(this.options.uri, { serverSelectionTimeoutMS: this.options.connectTimeoutMs, readPreference: "primaryPreferred" });
    await this.client.connect();
    await this.client.db(this.options.database).command({ ping: 1 });
    this.db = this.client.db(this.options.database);
  }

  async read(collection: string, filter: Record<string, unknown> = {}, limit = 50): Promise<Record<string, unknown>> {
    await this.connect();
    if (!this.options.allowedCollections.includes(collection)) throw new Error("MongoDB collection is not in the read allowlist");
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.db!.collection(collection).find(filter as Document, { projection: { password: 0, token: 0, access_token: 0, refresh_token: 0, client_secret: 0, private_key: 0, privateKey: 0, apiKey: 0, secret: 0 } }).limit(safeLimit).toArray();
    return { authenticated: true, database: this.options.database, collection, count: rows.length, rows: sanitize(rows) as unknown[] };
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
    this.db = undefined;
  }
}

