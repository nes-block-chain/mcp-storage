#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { PcStorageSdk } from "./pc-storage-sdk.js";

const API_BASE_URL = process.env.PC_STORAGE_API_URL ?? "http://localhost:8094";
const API_TOKEN = process.env.PC_STORAGE_API_TOKEN;
const IPFS_MCP_URL = process.env.IPFS_MCP_URL;
const IPFS_API_URL = process.env.IPFS_API_URL ?? "http://127.0.0.1:5001";
const PC_STORAGE_ROOT = process.env.PC_STORAGE_ROOT ?? "D:\\container\\multi-container-app\\app\\DockerDesktopVMM\\data\\data-center\\data_leaning\\pc_storage";
const IPFS_DOWNLOAD_DIR = process.env.IPFS_DOWNLOAD_DIR ?? resolve(PC_STORAGE_ROOT, "out_sync", "ipfs", "downloads");
const MAX_ITEMS = 100;
const sdk = new PcStorageSdk({ baseUrl: API_BASE_URL, token: API_TOKEN });

type ApiResult = Record<string, unknown>;

function safeSummary(value: ApiResult): ApiResult {
  const copy: ApiResult = { ...value };
  for (const key of ["token", "access_token", "refresh_token", "client_secret", "secret", "apiKey", "privateKey", "password"]) {
    delete copy[key];
  }
  if (Array.isArray(copy.entries)) copy.entries = copy.entries.slice(0, MAX_ITEMS);
  if (Array.isArray(copy.files)) copy.files = copy.files.slice(0, MAX_ITEMS).map((file) => {
    if (!file || typeof file !== "object") return file;
    const item = { ...(file as Record<string, unknown>) };
    delete item.content;
    delete item.data;
    return item;
  });
  return copy;
}

function result(value: ApiResult) {
  const sanitized = safeSummary(value);
  return { content: [{ type: "text" as const, text: JSON.stringify(sanitized, null, 2) }], structuredContent: sanitized };
}

function createServer(): McpServer {
  const server = new McpServer({ name: "pc-storage-mcp-plugin", version: "0.1.0" });

  server.registerTool("pc_storage_health", {
    title: "PC Storage Health",
    description: "ตรวจสอบสถานะ local PC Storage sandbox โดยคืนเฉพาะสถานะและ root ที่ API ประกาศ",
    inputSchema: z.strictObject({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (_args, ctx) => result(await sdk.health(ctx.mcpReq.signal) as ApiResult));

  server.registerTool("pc_storage_tree", {
    title: "PC Storage Tree",
    description: "อ่านรายการโฟลเดอร์/ไฟล์ใน PC Storage sandbox แบบอ่านอย่างเดียว; ห้ามใช้แทนคำสั่งลบหรือเขียนไฟล์",
    inputSchema: z.strictObject({
      path: z.string().max(500).default("").describe("เส้นทางสัมพัทธ์ภายใน pc_storage เช่น sync_cloud")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ path }, ctx) => result(await sdk.tree(path, ctx.mcpReq.signal) as ApiResult));

  server.registerTool("pc_storage_inventory", {
    title: "PC Storage Inventory",
    description: "สแกน metadata ของ PC Storage sandbox; ผลลัพธ์จะตัดเนื้อหาไฟล์และข้อมูลลับออก",
    inputSchema: z.strictObject({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (_args, ctx) => result(await sdk.inventory(ctx.mcpReq.signal)));

  server.registerTool("pc_storage_library", {
    title: "PC Storage Library",
    description: "อ่าน metadata จาก library ที่ลงทะเบียนแล้ว; ต้องมี PC_STORAGE_API_TOKEN และไม่คืนเนื้อหาไฟล์",
    inputSchema: z.strictObject({
      path: z.string().max(500).default("")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ path }, ctx) => result(await sdk.library(path, ctx.mcpReq.signal) as ApiResult));

  server.registerTool("pc_storage_ipfs_reference", {
    title: "PC Storage IPFS MCP Reference",
    description: "เรียก IPFS ผ่าน MCP ด้วย CID และคืนเฉพาะ reference/metadata; ไม่ดาวน์โหลด ipfs-data.tar และไม่คืน binary",
    inputSchema: z.strictObject({
      cid: z.string().regex(/^[A-Za-z0-9]+$/).max(128),
      tool: z.string().max(100).default("ipfs_get")
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, async ({ cid, tool }, ctx) => {
    if (!IPFS_MCP_URL) throw new Error("ยังไม่ได้ตั้งค่า IPFS_MCP_URL สำหรับ IPFS MCP");
    return result(await sdk.ipfsMcp({ endpoint: IPFS_MCP_URL, tool, cid, signal: ctx.mcpReq.signal }));
  });

  server.registerTool("pc_storage_ipfs_http_download", {
    title: "Download IPFS TAR over HTTP",
    description: "ดาวน์โหลดวัตถุจาก IPFS/Kubo ผ่าน HTTP /api/v0/get ลงโฟลเดอร์ปลายทางที่กำหนด; ไม่เขียนทับไฟล์เดิม",
    inputSchema: z.strictObject({
      cid: z.string().regex(/^[A-Za-z0-9]+$/).max(128),
      fileName: z.string().regex(/^[A-Za-z0-9._-]+$/).max(200).default("ipfs-data.tar")
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async ({ cid, fileName }, ctx) => result(await sdk.ipfsHttpDownload({
    cid,
    fileName,
    ipfsApiUrl: IPFS_API_URL,
    outputDir: IPFS_DOWNLOAD_DIR,
    signal: ctx.mcpReq.signal
  })));

  return server;
}

serveStdio(createServer);
console.error(`pc-storage-mcp-plugin connected to ${API_BASE_URL}`);
import { resolve } from "node:path";

