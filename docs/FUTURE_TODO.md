# WicketSplit future work

This backlog starts from the deployed product baseline. Prioritize reliability,
data integrity, and feedback from real teams before adding cricket-platform
scope.

## Current baseline

- Owner and co-treasurer accounts can manage multiple teams from one verified
  email; players use a reusable team link and PIN without registration.
- Teams contain reusable rosters and multiple leagues with manual, screenshot,
  or CricClubs game entry.
- League Fee, Fruits / Water, IV, and full umpiring credits are split equally
  across completed games and then among each game's eligible players.
- Custom expenses, settlement suggestions, confirmed repayments, player
  breakdowns, per-game calculations, and CSV exports are implemented.
- The responsive PWA has role-based mobile navigation and guarded startup sync.
- Lineup entry selects the Playing XI/XII once, defaults every selected player
  into the split, and keeps rare exclusions behind an optional adjustment;
  game-funded expense entry needs no duplicate player selection.

## P0 — feedback release reliability

- [ ] Add production error monitoring for authentication, invitation acceptance,
  workspace load/save, CricClubs sync, and failed deployments.
  - Acceptance: errors include route, status, correlation ID, release version,
    and redacted account/team identifiers.
- [ ] Create and test a D1 backup and restore runbook.
  - Acceptance: restore a non-production copy and verify team, membership,
    invitation, expense, credit, and payment counts.
- [ ] Add structured audit events for role changes and destructive actions.
  - Acceptance: team, league, game, player, expense, credit, payment, and access
    deletion events retain actor, target, time, and result.
- [ ] Improve authentication throttle guidance.
  - Acceptance: distinguish Firebase device blocking from WicketSplit's own
    rate limit, honor `Retry-After`, and prevent repeated submits while blocked.
- [ ] Add smoke tests for owner, co-treasurer, and team-member journeys on mobile.
  - Acceptance: cover sign-in, invitation acceptance, team switching, expense
    entry, settlement viewing, logout, and first-load synchronization.

## P1 — concurrency and data growth

- [ ] Add optimistic workspace versioning before supporting active simultaneous
  treasurer entry.
  - Acceptance: stale saves return a conflict and the UI offers reload/review;
    no save silently overwrites a newer team revision.
- [ ] Normalize teams, leagues, games, lineups, exclusions, expenses,
  participants, credits, and payments into record-level D1 tables.
  - Acceptance: routine mutations update only their record and related audit
    rows inside a transaction instead of sending the full account workspace.
- [ ] Add idempotency keys to financial and invitation mutations.
  - Acceptance: retries cannot duplicate expenses, credits, payments, invites,
    screenshot imports, or CricClubs games.
- [ ] Add pagination and indexed queries for long ledgers and game histories.
  - Acceptance: page size is bounded and common team/league/date queries use
    documented indexes.
- [ ] Add schema migrations and a verified legacy JSON migration path.
  - Acceptance: existing production teams retain identical balances, roles,
    record IDs, and CSV totals after migration.
- [ ] Run staged load and conflict tests.
  - Acceptance: publish measured latency/error results for expected beta,
    hundred-team, and thousand-team scenarios before making scale claims.

## P2 — product quality after feedback

- [ ] Remember the last selected team and league per authenticated account.
- [ ] Add in-app release notes and a lightweight feedback/report-problem action.
- [ ] Add optional team branding and a generic custom domain.
  - Update Sites DNS, Google Authorized JavaScript Origins, Firebase authorized
    domains, invitation URLs, and legal links together.
- [ ] Add treasurer-access recovery guidance when an accepted invitation belongs
  to a deleted WicketSplit account.
- [ ] Add accessible empty, loading, offline, and retry states to every external
  dependency flow.
- [ ] Evaluate push/install guidance only after PWA usage is observed.

## Security follow-up

- [ ] Commission an independent application-security review before storing
  materially valuable or regulated data.
- [ ] Document secret rotation and incident response for session, Firebase,
  invitation-encryption, and hosting credentials.
- [ ] Add automated dependency, secret, and static-analysis checks to CI.
- [ ] Define data retention and self-service export/deletion verification.

## Explicitly deferred

- Native App Store/Play Store applications
- Cricket scoring, live scores, statistics, brackets, chat, and bookings
- Bank/card/UPI/Zelle/Venmo payment processing or automatic reconciliation
- Public CricHeroes scraping without an authorized stable API
- AI screenshot processing on the server while local OCR remains sufficient

Add deferred scope only after repeated team feedback demonstrates that it
supports the core expense-and-settlement job.
