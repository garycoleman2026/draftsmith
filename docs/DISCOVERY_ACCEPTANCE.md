# Discovery and community acceptance contract

## Product journeys

- [x] Everyone can search and filter official and community bingo boards by text, category, and game style.
- [x] Every gallery board has an indexable detail page with a complete tile preview and editable task-sheet export.
- [x] Choosing a gallery board persists a device-local preference and preselects it in the next completed draft's bingo launchpad.
- [x] Public community boards are available directly inside organizer rooms and clone into immutable event tasks and rules.
- [x] Organizers can save private templates by default, explicitly publish a community template, and remove templates they manage.
- [x] Public publishing is bounded and rate limited; titles, summaries, categories, and tags are sanitized.
- [x] Community boards accept one changeable upvote or downvote per browser token without exposing a public identity.
- [x] Clan owners/admins can opt a clan profile into the public directory and describe it without publishing member names.
- [x] Each bingo event separately defaults to unlisted and can be opted into discovery only while public spectating remains enabled.
- [x] Public clan history includes only explicitly listed spectator events and publicly published templates.
- [x] Listed events receive indexable, event-specific metadata; unlisted public-link events remain `noindex`.
- [x] The sitemap includes static pages, official/community templates, opt-in clans, and explicitly listed events.
- [x] Privacy and terms pages disclose public listings, community content, votes, and the browser-scoped voting token.

## Verification gate

- [x] Versioned migrations add listing, gallery, browser-scoped voting, and public-profile state with private defaults.
- [x] Migration validation passes against fresh and legacy databases.
- [x] Pure metadata, official-template completeness, category, tag, visibility, and sort tests pass.
- [x] TypeScript, ESLint, the full unit suite, and the production build pass.
- [x] Local page smoke covers gallery search/detail, public clans/history, listed event pages, and sitemap discovery.
- [x] Local API smoke covers rate create/update, public publish, organizer visibility, community clone, clone counting, remove, and 404 after removal.
- [x] Local privacy smoke proves event discovery is off by default and is forced off whenever public spectating is disabled.
