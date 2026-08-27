# Terry's Drafting bingo implementation roadmap

## Product contract

Ordinary boards are self-service. Organizers compose layouts, game rules, and task rules from safe versioned primitives. A code expansion is required only when a requested game needs a verifier or mechanic the rule engine cannot express.

## Delivery stages

Status: stages 1 through 4 are implemented. Stage 5 is the next active delivery stage.

1. **Custom maker — shipped** — variable grids, six game styles, OSRS presets, drag-and-drop editing, spreadsheet round-tripping, template cloning, validation, and prerequisite enforcement.
2. **Verification engine — shipped** — normalized evidence events, confidence/source labels, idempotent matching, progress candidates, replay, and organizer audit controls.
3. **Wise Old Man — shipped** — event baselines, periodic checkpoints, final reconciliation, optional group-bulk syncing, rate-safe roster syncing, and automatic XP/level/KC candidates without aggressive upstream polling or forced player updates.
4. **RuneLite service contract — shipped** — one-time exact-RSN pairing, revocable hashed device credentials, minimal scoped event batches, rate limits, device and batch deduplication, a public data disclosure, and an ETag-aware event overlay API.
5. **RuneLite plugin** — public standalone repository, team/board overlay, manual submission, XP and supported chat/loot events, disclosure of transmitted data, tests, and Plugin Hub submission.
6. **Discovery and growth** — public template gallery, cloning, categories, search, ratings, clan history, event landing pages, and content needed for sustainable public hosting.

## Verification principles

- Wise Old Man snapshots are best for periodic XP, level, activity, and boss-KC reconciliation.
- RuneLite observations make progress near-live but are client reports, not cryptographic proof.
- Screenshots and organizer review remain the universal fallback.
- Each candidate and completion records its evidence source and confidence.
- Published events retain immutable rule versions so later template edits cannot rewrite history.
