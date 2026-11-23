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

