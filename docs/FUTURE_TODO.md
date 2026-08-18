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
- The product is published at `https://www.wicketsplit.com`; Sites custom-domain
  DNS is active for `www`, and Google/Firebase authorize both official origins.
- Early-access requests require no account; administrator approval produces an
  email-bound, single-use seven-day signup link and a prefilled email draft.
- Lineup entry selects the Playing XI/XII once, defaults every selected player
  into the split, and keeps rare exclusions behind an optional adjustment;
  game-funded expense entry needs no duplicate player selection.

## P0 — feedback release reliability

- [ ] Add production error monitoring for authentication, invitation acceptance,
  workspace load/save, CricClubs sync, and failed deployments.
  - Acceptance: errors include route, status, correlation ID, release version,
    and redacted account/team identifiers.
- [x] Add portable team backup, guarded owner restore, and a recovery runbook.
  - Delivered: checksum validation, record validation, pre-restore snapshots,
    ten-point retention, and documented verification steps.
- [ ] Automate and rehearse provider-level whole-D1 disaster recovery.
  - Acceptance: restore a non-production copy and verify team, membership,
    invitation, expense, credit, payment, feedback, and restore-point counts.
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

- [x] Add optimistic workspace versioning before supporting active simultaneous
  treasurer entry.
  - Acceptance: stale saves return a conflict and the UI offers reload/review;
    no save silently overwrites a newer team revision.
- [x] Move teams, players, leagues, games, expenses, credits, and payments into
  indexed record-level D1 tables with an automatic legacy migration and atomic
  rollback snapshot.
- [ ] Replace full-workspace saves with record-specific mutation APIs.
  - Acceptance: routine mutations update only their record and related audit
    rows instead of submitting and rewriting the full team record set.
- [ ] Add idempotency keys to financial and invitation mutations.
  - Acceptance: retries cannot duplicate expenses, credits, payments, invites,
    screenshot imports, or CricClubs games.
- [x] Add bounded client-side pagination for game history and the finance
  ledger, plus indexes for current membership and invitation query patterns.
- [ ] Move pagination to record-level server queries after workspace
  normalization.
  - Acceptance: page size is bounded and team/league/date queries page without
    loading the complete workspace.
- [x] Add schema migrations and a verified legacy JSON migration path.
  - Acceptance: existing production teams retain identical balances, roles,
    record IDs, and CSV totals after migration.
- [ ] Run staged load and conflict tests.
  - Acceptance: publish measured latency/error results for expected beta,
    hundred-team, and thousand-team scenarios before making scale claims.

## P2 — product quality after feedback

- [ ] Remember the last selected team and league per authenticated account.
- [ ] Add in-app release notes.
- [x] Add a lightweight public and in-app feedback/report-problem action with
  rate limiting and an administrator review queue.
- [x] Add a generic production domain and synchronize Sites DNS, Google
  Authorized JavaScript Origins, and Firebase authorized domains.
- [ ] Finish branded authentication delivery.
  - Acceptance: Firebase verification and password-reset emails use the
    WicketSplit sender name, subjects, and approved custom action-link domain;
    inbox and spam-folder behavior is tested with multiple providers.
- [ ] Enforce a canonical-host redirect after the zone-apex TLS certificate is
  active.
  - Acceptance: `https://wicketsplit.com/*` redirects to the equivalent
    `https://www.wicketsplit.com/*` path without losing invitation tokens.
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

The current baseline also includes a compact tabbed Settlement experience,
mobile treasurer/co-treasurer access to Settlement, in-place payment recording,
and an irreversible read-only lock for fully settled completed leagues.
