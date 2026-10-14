# Database Backup And Point-In-Time Recovery

## Protection

### Local development

- Base Compose enables a daily backup at 03:20 and retains generated full backups for 2 days. `DB_BACKUP_*` environment settings can override these defaults.
- Local MySQL uses `docker/mysql/conf.local/pik5.cnf`, retaining binlogs for 3 days. Production continues to use `conf.d/pik5.cnf` (30 days) and defaults to 14 days of full backups.
- The purpose of local backups is recovery from an accidental destructive operation during development, not a cumulative historical archive. Before Codex performs destructive DB work, create and verify a fresh full backup with binlog coordinates. Preserve its subsequent binlogs until the work is verified.
- Daily backups cover the configured application database. Before purging shared binlogs, separately back up any auxiliary databases that must be preserved.
- A full backup alone restores its snapshot time. To restore immediately before a later accidental deletion, replay the binlogs after that snapshot. A missing daily backup or an idle local environment lasting beyond the retention window requires a fresh backup before DB work.
- Generated backup cleanup only targets `<database>-YYYYMMDD-HHMMSS.sql.gz`. Migration exports, manual archives, and recovery evidence are excluded.

### Production

- Production Laravel blocks `db:wipe`, `migrate:fresh`, `migrate:refresh`, and `migrate:reset`, even with `--force`. `docker-compose.prod.yml` forces this protection independently of `APP_ENV`.
- MySQL stores ROW-format binary logs for 30 days with durable transaction settings.
- Binary logs are stored in `/var/lib/mysql`. They do not protect against loss of the MySQL volume or host.
- Mount `backups/mysql` to storage outside the database host and monitor successful backup creation.

Enable daily full backups in the production environment:

```dotenv
DB_PROTECT_DESTRUCTIVE_COMMANDS=true
DB_BACKUP_ENABLED=true
DB_BACKUP_KEEP_DAYS=14
DB_BACKUP_TIME=03:20
```

The production Compose override enables backups and runs Laravel `schedule:work` in the dedicated `laravel-scheduler` service. The scheduled backup uses `mysqldump`, which is installed when the Laravel image is rebuilt.

If `db:backup` reports that `mysqldump or mariadb-dump is not installed`, the production Laravel container is using an old image. Pulling source files does not install Dockerfile packages. Rebuild and recreate both Laravel services:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build laravel laravel-scheduler
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate laravel laravel-scheduler
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec laravel sh -lc 'command -v mysqldump || command -v mariadb-dump'
```

Create and verify a backup manually:

```bash
docker compose exec laravel php artisan db:backup
gzip -t backups/mysql/bowsprit-YYYYMMDD-HHMMSS.sql.gz
```

If the database user lacks `RELOAD` or `FLUSH_TABLES`, use `php artisan db:backup --without-binlog-position` for a full pre-deployment rollback backup. This omits the binlog position needed for precise point-in-time replay. Confirm all dumped tables use a transactional engine before relying on the `--single-transaction` snapshot, and verify the resulting file with `gzip -t`. Keep the normal scheduled backup with binlog coordinates enabled; arrange the missing privilege for durable point-in-time recovery.

## Point-In-Time Recovery

1. Stop application writes and preserve the current MySQL volume and binary logs.
2. Create a separate recovery MySQL instance. Never test recovery directly against production.
3. Restore the newest full backup created before the destructive operation.
4. Inspect binlogs with `mysqlbinlog` and identify the position or timestamp immediately before the destructive statement.
5. Replay binlogs from the backup time through that position into the recovery instance.
6. Validate row counts, foreign-key relationships, and application behavior.
7. Replace production data only after validation and after taking another snapshot of the damaged production state.

Example inspection and replay:

```bash
mysqlbinlog --base64-output=DECODE-ROWS --verbose /var/lib/mysql/binlog.000123
mysqlbinlog --stop-position=POSITION /var/lib/mysql/binlog.000123 | mysql RECOVERY_DATABASE
```

If valid writes occurred after the destructive statement, recover them separately from later binlog events. Replaying directly through the destructive statement will delete the restored data again.

## Operational Limits

- The Laravel command guard does not block direct SQL, Prisma commands, compromised credentials, or deletion from application code.
- Use separate runtime and migration DB users in production. The runtime user should not have `DROP`, `ALTER`, `CREATE`, or `TRIGGER` privileges.
- Store backups on another host or object storage with retention/versioning. A bind mount on the same host is not sufficient for host failure.
- Alert when daily backups are missing, too small, or fail decompression.
