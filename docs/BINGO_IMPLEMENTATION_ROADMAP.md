# Terry's Drafting bingo implementation roadmap

## Product contract

Ordinary boards are self-service. Organizers compose layouts, game rules, and task rules from safe versioned primitives. A code expansion is required only when a requested game needs a verifier or mechanic the rule engine cannot express.

## Delivery stages

Status: product stages 1 through 6 are implemented. The RuneLite beta is ready for the owner’s in-game test. Stage 7—community growth and advertising—is intentionally deferred until real clans are using the service.

1. **Account, clan, and ownership model — shipped** — personal and clan drafts, bingos, and boards are separate resources with private, clan-only, unlisted, and public visibility.
2. **Guided event setup — shipped** — one launcher routes organizers into draft-only, bingo-only, or draft-then-bingo journeys without mixing account and clan settings.
3. **Organizer operations — shipped** — readiness checks, event-scoped organizers and scorekeepers, claim notes, announcements, pause/resume, manual progress, link rotation, and final reconciliation controls.
4. **Trusted task catalogue — shipped** — stable task keys, exact boss/item targets, difficulty and readiness filters, planning estimates, proof labels, experimental separation, and resilient OSRS Wiki artwork lookup.
5. **RuneLite beta — ready for field test** — combat-achievement collection is removed, retry data survives restarts, queues are bound to one character, and the Java test suite passes. A real in-game test remains the gate before Plugin Hub submission.
6. **Hosted Wise Old Man tracking — shipped** — start/final snapshots plus scheduled group checkpoints continue while the organizer room is closed, with leases, retries, and visible health timing.
7. **Community growth — deferred** — marketplace tuning, moderation workflows, AdSense, and promotion wait for real usage and feedback. Existing public discovery remains available without ad code.

## Verification principles

- Wise Old Man snapshots are best for periodic XP, level, activity, and boss-KC reconciliation.
- RuneLite observations make progress near-live but are client reports, not cryptographic proof.
- Screenshots and organizer review remain the universal fallback.
- Each candidate and completion records its evidence source and confidence.
- Published events retain immutable rule versions so later template edits cannot rewrite history.
