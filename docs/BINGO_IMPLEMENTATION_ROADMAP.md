# Terry's Drafting bingo implementation roadmap

## Product contract

Ordinary boards are self-service. Organizers compose layouts, game rules, and task rules from safe versioned primitives. A code expansion is required only when a requested game needs a verifier or mechanic the rule engine cannot express.

## Delivery stages

Status: stages 1 through 4, standalone event creation, and the self-service discovery product are implemented. The RuneLite source beta is public; real in-game confirmation is the remaining gate before Plugin Hub submission. Advertising activation remains account/domain work rather than an application-code shortcut.

1. **Custom maker — shipped** — variable grids, six game styles, OSRS presets, drag-and-drop editing, spreadsheet round-tripping, template cloning, validation, prerequisite enforcement, and a direct copy/paste path for clans whose teams already exist.
2. **Verification engine — shipped** — normalized evidence events, confidence/source labels, idempotent matching, progress candidates, replay, and organizer audit controls.
3. **Wise Old Man — shipped** — event baselines, periodic checkpoints, final reconciliation, optional group-bulk syncing, rate-safe roster syncing, and automatic XP/level/KC candidates without aggressive upstream polling or forced player updates.
4. **RuneLite service contract — shipped** — one-time exact-RSN pairing, revocable hashed device credentials, minimal scoped event batches, rate limits, device and batch deduplication, a public data disclosure, and an ETag-aware event overlay API.
5. **RuneLite plugin — source beta shipped, validation pending** — public standalone repository, team/board overlay, manual submission, XP and supported chat/loot events, disclosure of transmitted data, tests, and production service integration are shipped. A real in-game test must pass before Plugin Hub submission.
6. **Discovery and growth — shipped** — public template gallery, safe organizer-room reuse, categories, search, browser-scoped ratings, opt-in clan history, separately opt-in event landing pages, public task presets, guides, trust pages, and search metadata. Ad code remains intentionally absent until a real publisher ID, domain decision, and required consent controls exist.

## Verification principles

- Wise Old Man snapshots are best for periodic XP, level, activity, and boss-KC reconciliation.
- RuneLite observations make progress near-live but are client reports, not cryptographic proof.
- Screenshots and organizer review remain the universal fallback.
- Each candidate and completion records its evidence source and confidence.
- Published events retain immutable rule versions so later template edits cannot rewrite history.
