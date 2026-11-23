# PC Storage SDK connector

`src/pc-storage-sdk.ts` is a typed TypeScript connector for the local PC Storage API.
It supports health, storage, library, proof, and one-time signed-certificate relay.

## Runtime configuration

Keep credentials outside the generated client and source tree:

```powershell
$env:PC_STORAGE_API_URL = "http://localhost:8094"
$env:PC_STORAGE_API_TOKEN = "<short-lived-token>"
npm run build
```

The token is only read at process startup and is never returned by the SDK. The
connector does not download files or expose file contents; it returns metadata and
privacy-preserving proof data only.

## IPFS MCP

ค้นพบตัวเชื่อมต่อที่ตรงกับงานใน repository:

`https://github.com/nes-block-chain/ipfs-mcp`

รายละเอียดการค้นหาและรายชื่อ tools ถูกบันทึกไว้ใน [ipfs-mcp.discovery.json](../ipfs-mcp.discovery.json)
ตัว repository ใช้ MCP แบบ `stdio` และเชื่อม Kubo ผ่าน `IPFS_API_URL`; จึงไม่ควรสมมติว่า
มี HTTP MCP endpoint ที่พอร์ต 5001 โดยตรง พอร์ต 5001 เป็น Kubo RPC ตามค่าเริ่มต้น

การทำงานเดิมที่ดาวน์โหลด `ipfs-data.tar` ถูกเปลี่ยนเป็นการเรียก IPFS MCP แบบ
reference-only โดยให้รัน `ipfs-mcp` เป็น MCP server แล้วเชื่อมผ่าน MCP host:

```powershell
$env:IPFS_API_URL = "http://127.0.0.1:5001"
```

จากนั้นเรียก `ipfs_stat` หรือ `ipfs_get` ผ่าน MCP host ด้วย CID โดย PC Storage
connector จะไม่ดาวน์โหลดหรือส่ง binary ของ archive กลับเอง

## HTTP download

ถ้าต้องการโหลด `ipfs-data.tar` จริง ให้เรียกเครื่องมือ
`pc_storage_ipfs_http_download` พร้อม CID ระบบจะเรียก:

```text
POST http://127.0.0.1:5001/api/v0/get?arg=<CID>
```

และบันทึกไฟล์ใหม่ลงใน `pc_storage\out_sync\ipfs\downloads` โดยไม่เขียนทับไฟล์เดิม
สามารถเปลี่ยนปลายทางด้วย `IPFS_DOWNLOAD_DIR` ได้

## Example

```ts
import { PcStorageSdk } from "./pc-storage-sdk.js";

const client = new PcStorageSdk({
  baseUrl: process.env.PC_STORAGE_API_URL,
  token: process.env.PC_STORAGE_API_TOKEN,
});

const status = await client.health();
const proof = await client.proof();
const library = await client.library("ipfs_storage");
```

The MCP tool `pc_storage_library` exposes the same read-only library operation.
It requires `PC_STORAGE_API_TOKEN` and returns metadata only; file bytes are removed
before the response is shown.

