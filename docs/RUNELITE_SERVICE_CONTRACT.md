# RuneLite service contract v1

## Trust model

RuneLite reports are authenticated client observations, not cryptographic proof. They enter the same versioned candidate engine as Wise Old Man and organizer evidence. Organizers can review them, and a second source can corroborate them.

## Pairing

1. A private team board issues a random 12-character code bound to one event, team, and roster member.
2. Only a hash of the code is stored. It expires in ten minutes and is consumed once.
3. Redemption requires the exact normalized in-game name, disclosure version 1, affirmative consent, and a subset of organizer-approved scopes.
4. The server returns `rl1.<device-id>.<secret>` once. Only the secret hash is stored.
5. A member can have at most three active devices. Team, organizer, and self-service revocation are supported.

## Privacy scopes

- `xp`: XP deltas and levels.
- `loot`: item drops, pets, and collection-log slots.
- `kills`: boss-kill observations.
- `raids`: raid completions, participant names when required, and completion times.
- `achievements`: combat achievements and clues.

Raw chat, credentials, bank contents, full inventory/equipment, friends lists, and continuous location history are not accepted by the contract. Unknown fields are discarded during normalization.

## API

- `POST /api/runelite/pair` — redeem one pairing code.
- `POST /api/runelite/events` — submit a bounded batch of 1–25 normalized observations. Requires bearer credential and matching `X-RuneLite-RSN`.
- `GET /api/runelite/overlay` — fetch the paired team, standings, board, progress, and task-specific capture plan. Supports `ETag`/`If-None-Match`.
- `DELETE /api/runelite/device` — revoke the caller’s device.

Each batch has a stable 8–64 character `batchKey`; each observation has a stable 8–64 character `clientEventId`. The service namespaces observation IDs by device and the verification database enforces source-level idempotency.

Shared boss and raid observations should also include an 8–64 character `correlationId` derived from the encounter, completion time, and sorted party. The service uses that team-scoped key to collapse the same completion reported by several paired clients.

## Accepted observation types

`xp_delta`, `level_reached`, `item_drop`, `pet_drop`, `collection_log`, `boss_kill`, `raid_complete`, `raid_time`, `combat_achievement`, and `clue_complete`.

The overlay capture plan tells the plugin which verifier targets are currently relevant. The plugin should not transmit unrelated gameplay events.
