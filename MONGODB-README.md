# MongoDB read connector

`mcp_storage_mongodb_read` reads MongoDB only after successful MongoDB authentication.
Credentials stay outside source code and are supplied at runtime:

```powershell
$env:MONGO_STORAGE_URI = "mongodb://user:password@host:27017/?authSource=admin"
$env:MONGO_STORAGE_DB = "database_name"
$env:MONGO_STORAGE_COLLECTIONS = "library,metadata,backups"
```

The connector refuses to run without the URI and database name, refuses collections
outside the allowlist, limits results to 100 documents, and removes common secret
fields before returning data. It has no insert, update, delete, drop, or aggregation
write tool.

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
`out_sync`; it never uploads file contents. `mcp_storage_mongodb_read` then reads the
allowlisted collection after MongoDB authentication.

