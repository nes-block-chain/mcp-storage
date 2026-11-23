#!/usr/bin/env python3
"""Daily MediaWiki change check with encryption-before-IPFS staging.

This script only creates an encrypted local staging artifact and a metadata report.
An IPFS upload must happen in a separate, authenticated step after verification.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError as exc:
    raise SystemExit("cryptography is required; refusing to create an unencrypted backup") from exc

SOURCE_URL = "https://www.mediawiki.org/wiki/MediaWiki"
ROOT = Path(os.environ.get("PC_STORAGE_ROOT", r"D:\container\multi-container-app\app\DockerDesktopVMM\data\data-center\data_leaning\pc_storage"))
STATE_DIR = ROOT / "out_sync" / "ipfs" / "manifests" / "mediawiki"
BACKUP_DIR = ROOT / "out_sync" / "ipfs" / "backups" / "mediawiki"
REPORT_DIR = ROOT / "library" / "reports" / "mediawiki"


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def key() -> bytes:
    raw = os.environ.get("IPFS_BACKUP_KEY_B64", "")
    try:
        decoded = base64.b64decode(raw, validate=True)
    except Exception as exc:
        raise SystemExit("IPFS_BACKUP_KEY_B64 must be a base64-encoded 32-byte key") from exc
    if len(decoded) != 32:
        raise SystemExit("IPFS_BACKUP_KEY_B64 must decode to exactly 32 bytes")
    return decoded


def fetch() -> tuple[bytes, dict[str, str], int]:
    request = Request(SOURCE_URL, headers={"User-Agent": "pc-storage-mediawiki-monitor/1.0", "Accept": "text/html"})
    with urlopen(request, timeout=30) as response:
        return response.read(), {k.lower(): v for k, v in response.headers.items()}, response.status


def main() -> int:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    checked_at = now()
    previous_path = STATE_DIR / "latest.json"
    previous = json.loads(previous_path.read_text(encoding="utf-8")) if previous_path.exists() else {}
    try:
        content, headers, status = fetch()
        available = True
    except Exception as exc:
        report = {"schemaVersion": 1, "reportType": "daily-source-change-check", "source": SOURCE_URL, "checkedAt": checked_at, "sourceAvailable": False, "changed": False, "missing": True, "encryptedBackupCreated": False, "ipfsRegistered": False, "notes": [str(exc)]}
        (REPORT_DIR / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        return 2
    raw_digest = hashlib.sha256(content).hexdigest()
    changed = raw_digest != previous.get("rawSha256", "")
    backup_id = f"mediawiki-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{secrets.token_hex(4)}"
    nonce = secrets.token_bytes(12)
    encrypted = nonce + AESGCM(key()).encrypt(nonce, content, SOURCE_URL.encode("utf-8"))
    encrypted_path = BACKUP_DIR / f"{backup_id}.bin"
    encrypted_path.write_bytes(encrypted)
    encrypted_digest = hashlib.sha256(encrypted).hexdigest()
    report = {"schemaVersion": 1, "reportType": "daily-source-change-check", "source": SOURCE_URL, "checkedAt": checked_at, "previousCheckAt": previous.get("checkedAt"), "result": "changed" if changed else "unchanged", "sourceAvailable": available, "changed": changed, "missing": False, "httpStatus": status, "etag": headers.get("etag"), "lastModified": headers.get("last-modified"), "rawSha256": f"sha256:{raw_digest}", "previousRawSha256": f"sha256:{previous.get('rawSha256', '')}" if previous.get("rawSha256") else None, "encryptedBackupCreated": True, "encryptedFile": str(encrypted_path), "encryptedSha256": f"sha256:{encrypted_digest}", "ipfsRegistered": False, "notes": ["Encrypted staging only; IPFS registration is a separate authenticated step."]}
    (REPORT_DIR / "latest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    previous_path.write_text(json.dumps({"checkedAt": checked_at, "rawSha256": raw_digest, "encryptedSha256": encrypted_digest}, indent=2), encoding="utf-8")
    print(json.dumps({"status": "ok", "changed": changed, "report": str(REPORT_DIR / 'latest.json'), "encryptedFile": str(encrypted_path)}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

