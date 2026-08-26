# Terry's Drafting phases 1-4 acceptance contract

This file is the completion checklist for the production, account, drafting,
and integration work requested after the public MVP. A phase is complete only
when its behavior is implemented and covered by an automated or end-to-end
verification.

## Phase 1: production hardening

- [x] Versioned D1 migrations are the production schema authority.
- [x] New organizer, signup, captain, participant, and session credentials are
  stored only as cryptographic hashes and can be revoked.
- [x] Legacy links are upgraded without breaking active events.
- [x] Draft creation, signup, authentication, and player-intelligence requests
  have durable rate limits and public forms have bot traps.
- [x] Imported and signed-up RuneScape names use one canonical validator.
- [x] External player data is cached, freshness-labelled, and resilient to an
  upstream outage.
- [x] Mutating organizer, captain, signup, and live actions create audit events.
- [x] Simultaneous live-pick requests cannot assign a player or turn twice.
- [x] Core draft, constraint, live-turn, normalization, and optimizer invariants
  have automated tests.

## Phase 2: organizer accounts and clans

- [x] Discord OAuth creates a revocable secure session when configured.
- [x] Anonymous event creation and existing organizer links continue to work.
- [x] Signed-in organizers can create clans and manage owner/admin/captain/member
  roles.
- [x] A dashboard lists active, scheduled, completed, and archived clan events.
- [x] An organizer can claim an existing event and mint a short-lived management
  link without exposing its permanent credential.
- [x] Events can be duplicated or saved as reusable templates.
- [x] Participant self-service links support editing and withdrawal before the
  registration deadline.
- [x] Registration supports capacity, waitlist, approval, deadlines, and answer
  visibility controls.
- [x] The event lifecycle is explicit and server-validated.

## Phase 3: best-in-class drafting

- [x] Captain score sheets remain private, are revisioned, and can be frozen at
  a ranking deadline.
- [x] Per-captain scores are normalized before consensus calculations.
- [x] Organizers can balance for consensus, playtime, PvM, skilling, raids, or a
  custom weighted preset.
- [x] Together/apart rules are explicitly hard or soft; hard rules are never
  overridden and impossible configurations fail with a useful explanation.
- [x] The optimizer improves a documented fairness objective through legal group
  moves and swaps while preserving team sizes.
- [x] Every run records its seed, configuration, fairness report, and immutable
  result history.
- [x] Organizers can preview a legal manual swap and save it as a new run.
- [x] Live drafts support configurable order, timer, pause/resume, pass/skip,
  undo-last-pick, together-group atomic picks, and optional ranking-based
  auto-picks.

## Phase 4: OSRS and Discord integrations

- [x] Roster intelligence is batch-prefetched and cached with source and update
  timestamps.
- [x] Official Hiscores remain the baseline and Wise Old Man adds historical
  EHP/EHB, weekly gains, boss, and raid information when available.
- [x] A 100-player roster does not issue one upstream request per render.
- [x] Discord webhooks can announce signup, registration close, captain ready,
  live pick, and published team events, with retry/audit state.
- [x] Results export as Discord markdown, CSV, JSON, and a downloadable image.
- [x] Integration failures never block the core draft workflow.
