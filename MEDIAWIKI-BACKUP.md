# MediaWiki daily backup

Source monitored:

`https://www.mediawiki.org/wiki/MediaWiki`

Run the monitor once per day. It fetches the public page, compares SHA-256 with the
previous check, creates an AES-256-GCM encrypted local artifact, and writes a report.
It fails closed when `cryptography` or `IPFS_BACKUP_KEY_B64` is missing. It does not
upload to IPFS automatically; upload the encrypted artifact through the authenticated
IPFS MCP/HTTP connector after review.

Required runtime key (never commit it):

```powershell
$env:IPFS_BACKUP_KEY_B64 = "<base64-encoded 32-byte key>"
python scripts/mediawiki_backup.py
```

Output:

- Encrypted backup: `out_sync/ipfs/backups/mediawiki/`
- State/manifest: `out_sync/ipfs/manifests/mediawiki/`
- Report: `library/reports/mediawiki/latest.json`

The report distinguishes `changed`, `unchanged`, and `missing`. Raw page content is
never placed in the report or Adaptive Card.

