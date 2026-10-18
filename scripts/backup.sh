set -euo pipefail
: "${MYSQL_CONTAINER:?Set exact Club Management MySQL container name}"
: "${BACKUP_DIR:?Set backup output directory}"
case "$MYSQL_CONTAINER" in *club-management*mysql*) ;; *) echo "Refusing non-Club container" >&2; exit 1;; esac
umask 077
mkdir -p -- "$BACKUP_DIR"
backup_file="$BACKUP_DIR/club-$(date -u +%Y%m%dT%H%M%SZ).sql"
if [ -e "$backup_file" ]; then echo "Backup file exists" >&2; exit 1; fi
trap 'rm -f -- "$backup_file.partial"' EXIT
docker exec "$MYSQL_CONTAINER" sh -c 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF --routines --triggers --events -u "$MYSQL_USER" "$MYSQL_DATABASE"' > "$backup_file.partial"
test -s "$backup_file.partial"
mv -- "$backup_file.partial" "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
printf 'Backup complete: %s\n' "$backup_file"
