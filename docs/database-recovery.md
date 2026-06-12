# Database Backup And Point-In-Time Recovery

## Protection

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

Create and verify a backup manually:

```bash
docker compose exec laravel php artisan db:backup
gzip -t backups/mysql/bowsprit-YYYYMMDD-HHMMSS.sql.gz
```

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
