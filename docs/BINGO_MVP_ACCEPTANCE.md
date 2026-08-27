# Bingo MVP acceptance contract

## Release goal

A completed Terry's Drafting event can become a hosted 5 × 5 clan bingo without re-entering teams. Organizers manage the event, each team receives a private claim link, and spectators receive a read-only live board.

## Required journeys

- [x] Create a classic, points, lockout, or saved-template bingo from completed draft results.
- [x] Snapshot team membership so later draft edits cannot silently change an active bingo.
- [x] Edit all 25 tasks by pasted pipe, tab, or CSV rows before the event starts.
- [x] Issue and rotate one private, hashed access link per team.
- [x] Start and complete an event; capture start/end player-intelligence snapshots in the background.
- [x] Submit a task for a named teammate with a note, HTTPS link, or private PNG/JPEG/WebP screenshot.
- [x] Approve or reject claims from the organizer room without exposing pending evidence publicly.
- [x] Apply classic-line, points, repeat-limit, and atomic shared-lockout scoring rules.
- [x] Show a polling team board and a public spectator board with optional delay.
- [x] Save the current board as a reusable draft/clan template.
- [x] Send optional Discord lifecycle and claim notifications through the existing encrypted webhook integration.

## Safety and operating limits

- Evidence is private to the organizer, limited to 5 MB, signature checked, stored in R2, and served with `nosniff`.
- Team and organizer credentials are stored only as hashes; newly issued raw links are shown once.
- Team claims and evidence uploads are rate limited.
- The first release supports exactly 25 tiles. Automatic RuneLite proof, automatic task completion from data providers, scheduled auto-start, and the full event tracker plugin are later stages.

## Verification gate

- [x] Migration validation passes against fresh and legacy databases.
- [x] Bingo scoring/parser unit tests pass.
- [x] TypeScript, ESLint, the full unit suite, production build, and production dependency audit pass.
- [x] Local API smoke covers create → start → claim → approve → public score.
- [ ] Hosted API and database are healthy after deployment.
