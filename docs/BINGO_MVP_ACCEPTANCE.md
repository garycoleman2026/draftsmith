# Bingo and custom-maker acceptance contract

## Release goal

A completed Terry's Drafting event can become a hosted 5 × 5 clan bingo without re-entering teams. Organizers manage the event, each team receives a private claim link, and spectators receive a read-only live board.

## Required journeys

- [x] Create a classic, points, lockout, blackout, progression, category, or saved-template bingo from completed draft results.
- [x] Snapshot team membership so later draft edits cannot silently change an active bingo.
- [x] Build 3 × 3 through 7 × 7 boards with drag-and-drop tiles, direct editing, or pasted pipe, tab, and CSV rows.
- [x] Start from a searchable library of at least 60 editable OSRS task presets.
- [x] Define each tile's verifier, target, amount, participant scope, proof sources, repeat limit, visibility, and prerequisites.
- [x] Validate and version event and tile rule documents while preserving legacy templates and imports.
- [x] Issue and rotate one private, hashed access link per team.
- [x] Start and complete an event; capture start/end player-intelligence snapshots in the background.
- [x] Submit a task for a named teammate with a note, HTTPS link, or private PNG/JPEG/WebP screenshot.
- [x] Approve or reject claims from the organizer room without exposing pending evidence publicly.
- [x] Apply classic-line, points, repeat-limit, and atomic shared-lockout scoring rules.
- [x] Show a polling team board and a public spectator board with optional delay.
- [x] Save the current board as a reusable draft/clan template.
- [x] Send optional Discord lifecycle and claim notifications through the existing encrypted webhook integration.
- [x] Normalize organizer, RuneLite, and Wise Old Man evidence into source-labelled, idempotent verification signals.
- [x] Match signals against versioned task targets, metrics, scopes, participant counts, comparators, and allowed proof sources.
- [x] Accumulate per-team progress without double-counting the same source across RuneLite and Wise Old Man.
- [x] Show confidence-labelled progress candidates to teams and an accept, dismiss, reopen, replay, and dry-run queue to organizers.
- [x] Preserve evidence source and confidence on every accepted claim, completion, public tile, and audit record.
- [x] Capture versioned Wise Old Man baselines, checkpoints, and final snapshots through a group-bulk or rate-safe player queue.
- [x] Convert in-window WOM XP, level, and boss-KC deltas into task-scoped verification candidates while retaining manual proof fallback.

## Safety and operating limits

- Evidence is private to the organizer, limited to 5 MB, signature checked, stored in R2, and served with `nosniff`.
- Team and organizer credentials are stored only as hashes; newly issued raw links are shown once.
- Team claims and evidence uploads are rate limited.
- Custom boards support 9–49 tiles in a square grid. Wise Old Man syncing is organizer-driven (or automatic while an organizer room is open); durable scheduled polling, RuneLite player pairing, and the full RuneLite tracker plugin remain later stages.

## Verification gate

- [x] Migration validation passes against fresh and legacy databases.
- [x] Bingo scoring, structured-rule, preset-library, variable-layout, prerequisite, and import/export tests pass.
- [x] Signal validation, source authorization, identity, participant-scope, target-ID, duration, aggregation, and corroboration tests pass.
- [x] TypeScript, ESLint, the full unit suite, production build, and production dependency audit pass.
- [x] Local API smoke covers create → start → claim → approve → public score.
- [x] Hosted API and database are healthy after deployment.
