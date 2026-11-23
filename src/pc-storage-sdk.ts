export type StorageEntry = {
  name: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
};

export type StorageTreeResponse = {
  root?: string;
  path?: string;
  entries: StorageEntry[];
};

export type HealthResponse = { status: "ok"; root?: string };

export type ProofResponse = {
  schemaVersion: number;
  generatedAt?: string;
  algorithm: "SHA-256";
  storage: {
    directoryCount?: number;
    fileCount?: number;
    totalBytes?: number;
    digest?: string;
  };
};

export type SignedCertificate = {
  payload: Record<string, unknown>;
  signature: string;
  algorithm: "Ed25519";
};

export type RelayResponse = {
  accepted: boolean;
  storedPath?: string;
  referenceId: string;
  scope?: string[];
};

export type PcStorageSdkOptions = {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type IpfsMcpOptions = {
  endpoint: string;
  tool?: string;
  cid: string;
  signal?: AbortSignal;
};

export type IpfsHttpDownloadOptions = {
  cid: string;
  outputDir: string;
  fileName?: string;
  ipfsApiUrl?: string;
  signal?: AbortSignal;
};

export type IpfsMetadata = {
  cid: string;
  fileName: string;
  outputPath: string;
  bytes: number;
  transport: "http";
  downloadedAt: string;
};

export function createIpfsMetadataCard(metadata: IpfsMetadata): Record<string, unknown> {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      { type: "TextBlock", text: "IPFS download metadata", weight: "Bolder", size: "Medium" },
      { type: "FactSet", facts: [
        { title: "CID", value: metadata.cid },
        { title: "File", value: metadata.fileName },
        { title: "Size", value: `${metadata.bytes.toLocaleString("en-US")} bytes` },
        { title: "Transport", value: "HTTP / Kubo" },
        { title: "Downloaded", value: metadata.downloadedAt }
      ] },
      { type: "Input.Text", id: "fileName", label: "File name", value: metadata.fileName, isRequired: true },
      { type: "Input.Text", id: "cid", label: "CID", value: metadata.cid, isRequired: true },
      { type: "TextBlock", text: "ข้อมูลนี้เป็นข้อมูลก่อนบันทึกเข้า IPFS; ไม่ดาวน์โหลดเนื้อหาใน ipfs-data.tar", wrap: true, isSubtle: true, spacing: "Medium" },
      { type: "TextBlock", text: "ขั้นที่ 1 อ่าน → ขั้นที่ 2 เปิดข้อมูลเดิม/แก้ไข → ขั้นที่ 3 บันทึก → ขั้นที่ 4 เปิดดูข้อมูลชุดที่สอง", wrap: true, isSubtle: true }
    ],
    actions: [
      { type: "Action.Submit", title: "เชื่อมต่อครั้งแรก", data: { operation: "connect_first_read_metadata", save: false } },
      { type: "Action.Submit", title: "เปิดข้อมูลย้อนหลัง / แก้ไข", data: { operation: "open_history_edit_preview", save: false } },
      { type: "Action.Submit", title: "เชื่อมต่อครั้งที่สอง / บันทึก", data: { operation: "connect_second_register", save: true } },
      { type: "Action.Submit", title: "เปิดดูข้อมูลที่สอง", data: { operation: "open_second_data", save: false } },
      { type: "Action.OpenUrl", title: "Open PC Storage", url: "http://localhost:8094/" }
    ]
  };
}

export class PcStorageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "PcStorageApiError";
  }
}

/**
 * Small generated-client-compatible adapter for PC Storage API.
 * Secrets stay outside this library; pass a short-lived token at runtime.
 */
export class PcStorageSdk {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: PcStorageSdkOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:8094").replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health", { signal });
  }

  async storage(signal?: AbortSignal): Promise<StorageTreeResponse> {
    return this.request<StorageTreeResponse>("/v1/storage", { signal });
  }

  async tree(path = "", signal?: AbortSignal): Promise<StorageTreeResponse> {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return this.request<StorageTreeResponse>(`/v1/tree${query}`, { signal });
  }

  async inventory(signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/v1/inventory", { signal });
  }

  async library(path = "", signal?: AbortSignal): Promise<StorageTreeResponse> {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return this.request<StorageTreeResponse>(`/v1/library${query}`, { signal });
  }

  async proof(signal?: AbortSignal): Promise<ProofResponse> {
    return this.request<ProofResponse>("/v1/proof", { signal });
  }

  async relayAuthorization(certificate: SignedCertificate, signal?: AbortSignal): Promise<RelayResponse> {
    return this.request<RelayResponse>("/v1/relay/authorization", {
      method: "POST",
      body: JSON.stringify({ certificate }),
      signal,
    });
  }

  async ipfsMcp(options: IpfsMcpOptions): Promise<Record<string, unknown>> {
    if (!/^https?:\/\//i.test(options.endpoint)) throw new Error("IPFS MCP endpoint must use HTTP(S)");
    if (!/^[A-Za-z0-9]+$/.test(options.cid)) throw new Error("Invalid IPFS CID");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetchImpl(options.endpoint, {
        method: "POST",
        signal,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name: options.tool ?? "ipfs_get", arguments: { cid: options.cid, mode: "reference" } } }),
      });
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new PcStorageApiError(`IPFS MCP returned HTTP ${response.status}`, response.status, body);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async ipfsHttpDownload(options: IpfsHttpDownloadOptions): Promise<Record<string, unknown>> {
    if (!/^[A-Za-z0-9]+$/.test(options.cid)) throw new Error("Invalid IPFS CID");
    const outputDir = resolve(options.outputDir);
    const fileName = basename(options.fileName ?? "ipfs-data.tar");
    if (fileName !== (options.fileName ?? "ipfs-data.tar") || !/^[A-Za-z0-9._-]+$/.test(fileName)) {
      throw new Error("Invalid output filename");
    }
    const outputPath = resolve(outputDir, fileName);
    if (!outputPath.startsWith(`${outputDir}\\`)) throw new Error("Output path escapes download directory");
    const apiUrl = (options.ipfsApiUrl ?? "http://127.0.0.1:5001").replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetchImpl(`${apiUrl}/api/v0/get?arg=${encodeURIComponent(options.cid)}`, { signal });
      if (!response.ok) throw new PcStorageApiError(`IPFS HTTP API returned HTTP ${response.status}`, response.status, await response.text());
      const bytes = new Uint8Array(await response.arrayBuffer());
      await mkdir(outputDir, { recursive: true });
      await writeFile(outputPath, bytes, { flag: "wx" });
      const downloadedAt = new Date().toISOString();
      return { downloaded: true, transport: "http", cid: options.cid, outputPath, fileName, bytes: bytes.byteLength, downloadedAt, ipfsReadingUrl: "http://localhost:8094/ipfs",
        card: createIpfsMetadataCard({ cid: options.cid, fileName, outputPath, bytes: bytes.byteLength, transport: "http", downloadedAt }) };
    } finally {
      clearTimeout(timer);
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...options,
        signal,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...options.headers,
        },
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new PcStorageApiError(`PC Storage API returned HTTP ${response.status}`, response.status, body);
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

import { mkdir, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";


