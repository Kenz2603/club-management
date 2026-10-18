set -euo pipefail
: "${RESTORE_CONTAINER:?Set isolated restore container}"
: "${BACKUP_FILE:?Set backup SQL path}"
: "${CONFIRM_RESTORE:?Must equal isolated container name}"
case "$RESTORE_CONTAINER" in club-management-restore-*) ;; *) echo "Only isolated restore containers are allowed" >&2; exit 1;; esac
test "$CONFIRM_RESTORE" = "$RESTORE_CONTAINER"
test "$(docker inspect --format '{{index .Config.Labels "club-management.restore-test"}}' "$RESTORE_CONTAINER")" = true
test -r "$BACKUP_FILE"
sha256sum -c "$BACKUP_FILE.sha256"
table_count=$(docker exec "$RESTORE_CONTAINER" sh -c 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql -N -s -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()"')
test "$table_count" = 0
docker exec -i "$RESTORE_CONTAINER" sh -c 'export MYSQL_PWD="$MYSQL_PASSWORD"; exec mysql -u "$MYSQL_USER" "$MYSQL_DATABASE"' < "$BACKUP_FILE"
printf 'Restore completed on isolated target %s; verify schema and record counts before any recovery decision.\n' "$RESTORE_CONTAINER"
