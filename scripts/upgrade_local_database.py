"""Upgrade the project-local Miniflare D1 database after stopping the dev server."""

from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from validate_migrations import BREAKPOINT, ROOT


def main() -> None:
    database_directory = ROOT / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject"
    databases = [path for path in database_directory.glob("*.sqlite") if path.name != "metadata.sqlite"]
    if len(databases) != 1:
        raise RuntimeError(f"Expected one local D1 database, found {len(databases)}")
    database = databases[0].resolve()
    connection = sqlite3.connect(database)
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    columns = {row[1] for row in connection.execute("PRAGMA table_info(drafts)")}
    migrations: list[Path] = []
    if "admin_token_hash" not in columns:
        migrations.append(ROOT / "drizzle" / "0002_parched_maximus.sql")
    if "bingo_events" not in tables:
        migrations.append(ROOT / "drizzle" / "0003_special_joseph.sql")
    if not migrations:
        connection.close()
        print(f"Local database is already current: {database}")
        return
    migration_label = "-".join(path.stem.split("_")[0] for path in migrations)
    backup = database.with_suffix(f".before-{migration_label}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.bak")
    connection.close()
    shutil.copy2(database, backup)
    connection = sqlite3.connect(database)
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        for migration in migrations:
            for statement in migration.read_text(encoding="utf-8").split(BREAKPOINT):
                if statement.strip():
                    connection.execute(statement)
        connection.commit()
        failures = list(connection.execute("PRAGMA foreign_key_check"))
        if failures:
            raise RuntimeError(f"Foreign-key check failed: {failures[:5]}")
    except Exception:
        connection.rollback()
        connection.close()
        shutil.copy2(backup, database)
        raise
    connection.close()
    print(f"Applied {', '.join(path.stem for path in migrations)} to {database}")
    print(f"Recoverable backup: {backup}")


if __name__ == "__main__":
    main()
