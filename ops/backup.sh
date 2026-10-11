#!/bin/sh
set -eu
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="/backups/midad-$stamp.dump"
pg_dump --format=custom --no-owner --no-acl --file="$file"
sha256sum "$file" > "$file.sha256"
echo "Backup created: $file"
# Retention and off-site encrypted transfer must be configured by the operator.
