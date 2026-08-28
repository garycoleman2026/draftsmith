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
    task_columns = {row[1] for row in connection.execute("PRAGMA table_info(bingo_tasks)")} if "bingo_tasks" in tables else set()
    template_columns = {row[1] for row in connection.execute("PRAGMA table_info(bingo_templates)")} if "bingo_templates" in tables else set()
    verification_index_columns = (
        [row[2] for row in connection.execute("PRAGMA index_info(bingo_verification_events_idempotency_unique)")]
        if "bingo_verification_events" in tables else []
    )
    migrations: list[Path] = []
    if "admin_token_hash" not in columns:
        migrations.append(ROOT / "drizzle" / "0002_parched_maximus.sql")
    if "bingo_events" not in tables:
        migrations.extend(ROOT / "drizzle" / name for name in (
            "0003_special_joseph.sql", "0004_huge_warbird.sql", "0005_overconfident_exiles.sql",
            "0006_luxuriant_gargoyle.sql", "0007_nosy_obadiah_stane.sql", "0008_cooing_mandarin.sql",
        ))
    else:
        if "rule_json" not in task_columns:
            migrations.append(ROOT / "drizzle" / "0004_huge_warbird.sql")
        if "bingo_verification_events" not in tables:
            migrations.append(ROOT / "drizzle" / "0005_overconfident_exiles.sql")
            migrations.append(ROOT / "drizzle" / "0006_luxuriant_gargoyle.sql")
        elif verification_index_columns != ["event_id", "team_id", "source", "idempotency_key"]:
            migrations.append(ROOT / "drizzle" / "0006_luxuriant_gargoyle.sql")
        if "bingo_wom_integrations" not in tables:
            migrations.append(ROOT / "drizzle" / "0007_nosy_obadiah_stane.sql")
        if "bingo_runelite_integrations" not in tables:
            migrations.append(ROOT / "drizzle" / "0008_cooing_mandarin.sql")
    if "bingo_template_ratings" not in tables or "public_slug" not in template_columns:
        migrations.append(ROOT / "drizzle" / "0009_short_king_cobra.sql")
    if "bingo_manual_progress" not in tables:
        migrations.append(ROOT / "drizzle" / "0010_motionless_siren.sql")
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
