# MongoDB read connector

MongoDB is an internal backend for PC Storage API. Users and MCP clients must read
through `http://localhost:8094/v1/storage`; direct MongoDB reads are not exposed by
the MCP server. Credentials stay outside source code and are supplied at runtime:

```powershell
$env:MONGO_STORAGE_URI = "mongodb://user:password@host:27017/?authSource=admin"
$env:MONGO_STORAGE_DB = "database_name"
$env:MONGO_STORAGE_COLLECTIONS = "library,metadata,backups"
```

The backend refuses to run without the URI and database name, refuses collections
outside the allowlist, and removes common secret fields. The public MCP surface only
calls the authenticated PC Storage API.

## PC Storage → MongoDB → mcp-storage

To sync metadata from the local PC Storage root into MongoDB, run the metadata-only
sync script after setting the same MongoDB credentials:

```powershell
$env:PC_STORAGE_ROOT = "D:\container\multi-container-app\app\DockerDesktopVMM\data\data-center\data_leaning\pc_storage"
$env:MONGO_STORAGE_URI = "mongodb://user:password@host:27017/?authSource=admin"
$env:MONGO_STORAGE_DB = "database_name"
$env:MONGO_STORAGE_SYNC_COLLECTION = "pc_storage_metadata"
npm run build
node dist/pc-storage-mongo-sync.js
```

The sync writes metadata only. It excludes secrets, `.git`, `node_modules`, and
`out_sync`; it never uploads file contents. The PC Storage API exposes approved data
at `/v1/storage`, and `mcp-storage` reads only that endpoint.

