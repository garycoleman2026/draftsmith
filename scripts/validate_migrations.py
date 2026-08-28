"""Apply every D1 migration to fresh and legacy SQLite databases."""

from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "drizzle").glob("[0-9][0-9][0-9][0-9]_*.sql"))
BREAKPOINT = "--> statement-breakpoint"


def apply(connection: sqlite3.Connection, path: Path) -> None:
    for statement in path.read_text(encoding="utf-8").split(BREAKPOINT):
        if statement.strip():
            connection.execute(statement)
    connection.commit()


def validate_database(path: Path, seed_legacy: bool) -> None:
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    for index, migration in enumerate(MIGRATIONS):
        apply(connection, migration)
        if seed_legacy and index == 1:
            connection.execute(
                "INSERT INTO drafts (id, admin_token, title, draft_type, team_count, roster_mode, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ("legacy", "secret", "Legacy", "balanced", 2, "import", "collecting", "2026-01-01", "2026-01-01"),
            )
            connection.execute(
                "INSERT INTO players (id, draft_id, name, sort_order, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("player", "legacy", "Example", 0, "import", "2026-01-01"),
            )
            connection.commit()
    tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    required = {
        "drafts", "users", "sessions", "draft_runs", "player_insight_cache", "webhook_deliveries",
        "bingo_events", "bingo_teams", "bingo_team_members", "bingo_tasks", "bingo_evidence_uploads",
        "bingo_claims", "bingo_completions", "bingo_manual_progress", "bingo_activity", "bingo_templates", "bingo_template_votes", "bingo_player_snapshots",
    }
    assert required <= tables, f"Missing tables: {required - tables}"
    columns = {row[1] for row in connection.execute("PRAGMA table_info(drafts)")}
    assert {"admin_token_hash", "clan_id", "live_revision", "balance_preset"} <= columns
    if seed_legacy:
        assert connection.execute("SELECT title FROM drafts WHERE id = 'legacy'").fetchone() == ("Legacy",)
        assert connection.execute("SELECT name FROM players WHERE id = 'player'").fetchone() == ("Example",)
    assert not list(connection.execute("PRAGMA foreign_key_check")), "Foreign-key check failed"
    connection.close()


def main() -> None:
    assert MIGRATIONS, "No migrations found"
    with tempfile.TemporaryDirectory(prefix="terrys-migrations-") as directory:
        validate_database(Path(directory) / "fresh.sqlite", seed_legacy=False)
        validate_database(Path(directory) / "upgrade.sqlite", seed_legacy=True)
    print(f"Validated {len(MIGRATIONS)} migrations on fresh and legacy databases.")


if __name__ == "__main__":
    main()
