# WicketSplit

WicketSplit is a lightweight expense and settlement tracker for recreational
cricket teams. It records team costs, splits them fairly, and clearly shows who
should pay whom.

## Architecture documentation

- [High-level design](docs/HLD.md)
- [Low-level design](docs/LLD.md)
- [Product and experience review](docs/PRODUCT_REVIEW.md)
- [Future work and production roadmap](docs/FUTURE_TODO.md)

## Production

The public production site is:

<https://www.wicketsplit.com>

Official LinkedIn page: <https://www.linkedin.com/company/wicketsplit/>

The `www` hostname is the canonical product URL. The zone-apex hostname
`https://wicketsplit.com` is attached to the same Sites project and should be
used only after its managed TLS certificate reports active.

It can be shared for real-team feedback. Feedback users should use test-sized
amounts until the team agrees on its roster and access roles. WicketSplit
calculates settlements but does not move money.

## Product workflow

The public homepage uses a compact, swipeable feature tour with keyboard and
button controls, concise workflow and trust sections, and a persistent mobile
early-access action so visitors can understand the product without a long
scroll.

1. Sign in with Google or a verified Firebase email/password account.
2. Register one or more teams, add a reusable roster, and create leagues.
3. Record games with an optional date, opponent, and Playing XI or XII. Every
   selected player is included in the fair split by default; a treasurer can
   open the optional split adjustment only when a player should be excluded
   from that game's shared costs without being removed from the lineup or
   playing history. A treasurer can also import up to 10 squad screenshots in
   one reviewed batch.
4. Add expenses using one of four categories: Fruits / Water, League Fee,
   Restaurant, or Other. League Fee and Fruits / Water are allocated equally by
   completed game and then by each game's eligible players:

   `cost per game = team-funded expense ÷ completed games`

   `player share = sum(cost per game ÷ eligible players in that game)`

   No player selection is required when recording these game-funded expenses;
   saved Playing XI/XII lineups drive the split and future lineup edits
   recalculate the shares automatically.

5. Choose custom players or a games-played split for Restaurant and Other.
6. Open Settlement → Shares by game to review every game’s eligible players,
   allocated cost, and per-player share. The same breakdown is included in the
   settlement CSV.
7. Record umpiring for the team by entering the fixed credit per game once and
   the number of games umpired beside any players. Only non-zero rows are saved.
   Each player receives the full credit. That full credited amount is also added
   to the team cost pool, divided equally across completed games, and then split
   among each game’s eligible players. A player may therefore owe less, owe
   nothing, or finish with money to receive.
8. Share the suggested transfers showing who should pay whom.
9. A player can select **I paid — settle up** for their suggested transfer.
   The submission remains pending and does not change balances until a
   treasurer or co-treasurer confirms receipt. Treasurers may also record a
   payment directly after the receiver confirms it arrived.
10. Review the payment audit history or export the complete ledger as CSV.

Game history is paginated 12 at a time, and the searchable finance ledger is
paginated 20 entries at a time. Mobile pagination uses large Previous and Next
controls.

## Lightweight feature set

- Multiple teams, rosters, leagues, and treasurers
- Shared Team Member Mode with one revocable team link and 6-digit PIN; players
  select their roster identity without creating an account
- Server-enforced treasurer and team-member roles
- Account dropdown showing team-specific name, role, email, and roster phone
- Personal Home dashboard showing the signed-in player’s balance, payment
  direction, fair share, team payments, umpiring credits, and selected games
- One-time protected account-to-roster linking for treasurers or members whose
  signed-in identity is not already associated with a roster player
- Editable players, games, expenses, credits, and leagues
- Treasurer-only CricClubs import: connect a public team results URL once,
  discover recent leagues containing that team, link each CricClubs series to
  the matching WicketSplit league, reconcile each Playing XI/XII name to the
  roster, and import selected games with duplicate protection
- New-team CricClubs onboarding is available before any league exists: the
  Leagues page can discover a series, create the league, import completed
  games, and add previously missing lineup players to the shared team roster
- Private squad-screenshot import: select up to 10 images, detect the current
  team column, review the opponent and Playing XI/XII, match existing roster
  players, and add confirmed missing players. OCR runs in the browser; source
  screenshots are not uploaded or stored
- Safe roster deletion for unused players; historical or access-linked players are protected
- Owner-only team deletion removes the shared workspace, memberships, and outstanding invites
- Treasurer-only **Team users** view shows authenticated treasurers, active team-link player sessions, and pending invitations without exposing PINs, tokens, or hashes
- Treasurer controls to delete leagues, unlinked games, and expenses with clear confirmation and automatic balance recalculation
- Custom-player and games-played splits
- Four expense categories: Fruits / Water, League Fee, Restaurant, and Other
- Equal-per-game league fees and refreshment costs, divided by each game’s eligible players
- Per-game split eligibility: record the full Playing XI/XII while excluding
  selected players from League Fee and Fruits / Water allocation
- Settlement tabs for balances, per-game shares, and payment history without a separate calculator page
- Per-game calculation breakdown in Settlement and CSV showing each game’s
  equal allocation and its lineup-dependent cost per payer
- Batch umpiring entry with one fixed rate and per-player game counts; full
  credits are added to the equal-per-game team cost pool and itemized in Settlement
- Player calculation breakdowns, filters, duplicate protection, and CSV export
- Player-submitted settlement requests with treasurer confirmation, plus a
  confirmed repayment ledger with date, sender, receiver, amount, optional
  reference, remaining balances, and overpayment protection
- Mobile-friendly PWA installation and responsive navigation
- History-aware mobile navigation with an on-screen Back button and guarded
  left-edge swipe gesture for returning to the previous WicketSplit section
- Phone-friendly stacked cards for expense, balance, and payment-history
  ledgers, avoiding horizontal table navigation
- Explicit retry control if an automatic workspace save fails
- Google or Firebase email authentication with D1 persistence
- Public Privacy Policy, Terms of Use, and self-service account deletion

WicketSplit deliberately excludes scoring, statistics, auctions, brackets,
chat, bookings, merchandise, and payment processing.

## Team access and invitations

### Invite-only early access

The public product page remains visible, but a newly authenticated user cannot
create a first team until an early-access administrator approves the request.
Existing team owners, existing co-treasurers, accepted co-treasurer invitations,
and player link/PIN sessions continue to work normally.

New users request access publicly at `/request-access` using their name, email,
team name, and an optional note; no account is required. The administrator
reviews requests at `/early-access`. Approval creates a single-use, seven-day,
email-bound signup link and a ready-to-copy email message. The admin can also
open a prefilled draft in their own email app, so automated mail delivery is not
required. The default administrator is the product owner account. A deployment
can override or add administrators with the comma-separated
`EARLY_ACCESS_ADMIN_EMAILS` runtime setting. Approval is enforced by the server
when a new team is created, not only by the interface.

For ordinary players, a treasurer opens **Team roster → Team member access**,
creates one link and PIN, and shares the prepared WhatsApp message privately.
Each player opens the link, enters the PIN, selects their own roster name, and
lands on their personal Home page. The selected player can view team records;
only a treasurer or co-treasurer can record new expenses. Replacing or revoking the link
invalidates existing shared-member sessions. Link tokens and PINs are verified
with one-way hashes, while the reusable invitation is encrypted at rest.
Reopening Team member access shows the same message; only **Replace link & PIN**
rotates it and signs shared members out.

Shared access is intentionally lightweight rather than identity-proof: anyone
who has both secrets can select any roster player. The audit records the
selected player identity, so teams should keep the link and PIN within their
trusted group.

Co-treasurers continue to use individual authenticated accounts. Only a current
treasurer can create a co-treasurer invitation:

1. Add or edit the person in **Team roster** and add their email.
2. Select **Co-treasurer** on their roster card.
3. Create the invitation, review the exact prepared message, copy it, and send
   it through your preferred messaging or email app.
4. After acceptance, the roster card shows **Co-treasurer**. Another treasurer
   can select **Remove access** without deleting the player or financial history.

The original team owner and the currently signed-in treasurer cannot be removed
from their own roster card. Removing a co-treasurer also invalidates any older
unused invitation for that email.

Roles are enforced by the server:

- **Team member:** can view shared records but cannot add new expenses.
  Members may edit or delete only older expenses they previously submitted.
  Their streamlined navigation contains Home, Games, Expenses, and a private
  **My breakdown** view limited to their own balance, payment direction, and
  confirmed payment history. They can submit their own suggested outgoing
  payment for treasurer confirmation, but cannot confirm it or change balances.
  They cannot create or switch teams or change the roster,
  leagues, games, credits, settlements, or invitations.
- **Co-treasurer:** has full team-management access. These invitations require
  a roster email and can only be accepted by that verified email identity.
  Owners and co-treasurers see the complete Settlement table for every player,
  including Details, transfers, payment history, sharing, and CSV export on
  desktop and mobile.

Co-treasurer invitation links contain a 256-bit random bearer token. Only its
SHA-256 hash is stored. Links are email-restricted, single-use, expire after
seven days, and a new invitation replaces the previous unused invitation for
that player.

## Settlement payments

Expenses and credits calculate the original player balances. Repayments are
stored separately so expense history is never rewritten:

`remaining balance = original balance + payments sent − payments received`

The Settlement page continuously suggests who should pay whom based on the
player's fair share, expenses paid, umpiring credits, and confirmed payments.
Its table and Details view show each positive contribution and shared cost so
the remaining amount can be audited without reconstructing the formula.
A player may submit their own suggested outgoing payment. It remains pending,
is excluded from balances and exports, and appears in the treasurer's review
queue. A treasurer confirms it only after the receiver verifies arrival, or
rejects an incorrect submission. The form limits the amount to both the sender's remaining
debt and the receiver's remaining amount due. Each confirmed payment retains
its date, sender, receiver, amount, optional reference, and recorder. Deleting
an incorrect payment restores the prior balances and recalculates suggestions.
Confirmed payment history is included in the CSV export.

## Production security controls

- Google and Firebase ID tokens are checked server-side for signature, issuer,
  audience, expiry, provider, and verified email.
- Sessions are HMAC-signed `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- Private routes require authentication; team roles come from D1 rather than
  browser state.
- Mutation endpoints reject cross-origin browser requests.
- Workspace payloads are size-limited and structurally validated, including
  player, game, expense, credit, and participant references.
- D1 unique keys, batches, and atomic upserts protect invitation, membership,
  deletion, and rate-counter operations.
- State reads are limited to 120/minute/account and writes to 40/minute/account.
  Google login allows 20/minute/IP and email login 10/minute/IP. Invite creation
  allows 20/hour/account and 60/hour/IP; acceptance allows 20/minute/account and
  30/minute/IP. Account deletion allows 3/hour/account.
- Sensitive production values remain in the hosting environment. Passwords,
  verification codes, raw invitation tokens, and session secrets are not stored
  in workspace records or rollback snapshots.
- Referrer data is disabled to avoid forwarding invitation tokens.

These controls are appropriate for a lightweight feedback release. They do not
replace an independent penetration test, monitoring and alerting, tested
backups, or a compliance review if regulated or high-value data is introduced.

## Backup, recovery, and feedback

Authenticated treasurers can download a team backup from **Account → Backup &
recovery**. Only the original team owner can restore it. Restores validate the
file checksum and all record references, require the current team name, and
create a private pre-restore snapshot before replacing the team data. Backups
exclude account credentials, sessions, team PINs, memberships, and invitation
tokens. See [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md) for the operating
procedure and recovery checklist.

Anyone can use **Report a problem** from the public footer; signed-in users can
also open it from the account menu. Reports are rate-limited and stored in D1.
Configured early-access administrators can review and resolve them from the
private feedback queue.
Each team carries an optimistic version. A stale treasurer save is rejected and
the app asks that user to reload the latest team instead of silently replacing
another treasurer's work.

Team, league, player, game, expense, credit, and payment records are stored in
indexed D1 tables. Existing team JSON is migrated automatically on first load
and retained as an atomic rollback snapshot during the compatibility period.

### CricClubs game import

From **Games**, a treasurer can select **Sync CricClubs**, enter the CricClubs
club code (the short value after `cricclubs.com/`, such as `CL`) and confirm the
prefilled team name. WicketSplit saves both values and checks the most recent
CricClubs series for that team name. No team URL is required. For a newly discovered series,
WicketSplit creates a league using CricClubs' series name and season when the
treasurer confirms the reviewed games. This lookup is necessary because
CricClubs can assign the same team a different ID in each series.

When another season begins, use **Check for new leagues**, choose the discovered
series, review its completed matches and lineups, then select **Create league &
import games**. All selected games are added to the newly created league. Later
completed-game checks find that linked league and add only new matches.
WicketSplit requires every scorecard player to be mapped to a unique local
roster player before saving. Imported games retain the public CricClubs result
ID and link, which makes repeated sync checks idempotent.

The sync endpoint requires a signed-in treasurer, accepts only CricClubs hosts
and validated public identifiers, allows 12 checks per account per hour, and
does not send WicketSplit roster or financial data to CricClubs. CricClubs is an
external service; its public feed availability and format are outside
WicketSplit's control. Manual game entry remains available if the feed changes
or is temporarily unavailable.

### Squad screenshot import

From **Games**, a treasurer can select **Import screenshots** and choose up to
10 squad images at once. WicketSplit performs OCR in the browser, separates the
left and right team columns, and prefers the column matching the current team
name. Every game remains a draft until the treasurer confirms the team side,
opponent, optional date, and 11 or 12 unique roster matches.

Names are matched against the existing roster with typo tolerance. The
treasurer can correct recognized text, map it to another roster player, remove
an incorrect row, or confirm a new roster player. Only confirmed game and
roster records are saved. The source image is never posted to a WicketSplit
endpoint or retained in the workspace.

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm test
npm run lint
npm run typecheck
```

`.openai/hosting.json` contains the Sites project and logical D1 binding.
Production credentials are managed in the hosting environment and must not be
committed.

### Firebase email sign-in

Enable Email/Password and email verification in Firebase Authentication, add
the deployed domain to Firebase Authentication's authorized domains, and set:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Firebase hashes passwords and sends verification/reset emails. WicketSplit
receives a verified Firebase ID token and never receives or stores the password.
Firebase web configuration is public by design, but it is supplied only through
the hosting environment so automated secret scanners do not flag literal keys
in source control. Never commit service-account credentials or configuration
values. Restrict the Firebase browser key to the Firebase APIs and approved
website origins in Google Cloud Console.

### Production domain and OAuth

The Sites custom-domain configuration maps `www.wicketsplit.com` to
`custom-domains.chatgpt.site` and the zone apex to the Sites-provided A-record
targets. Domain-verification TXT records must remain in DNS. Keep both
`wicketsplit.com` and `www.wicketsplit.com` in Firebase Authentication's
authorized-domain list and in the Google OAuth client's Authorized JavaScript
Origins. Do not add a path or trailing slash to an OAuth origin. Retain the
Firebase handler URI under Authorized redirect URIs.

Invitation, team-access, and early-access approval URLs use the canonical
`https://www.wicketsplit.com` production origin, even when the app is opened
through an older Sites hostname. Local development continues to use localhost.
Existing bearer links remain valid until accepted, expired, replaced, or
revoked.

## Data model

Each verified identity has an account record. Teams are stored once in D1 and
linked to users through memberships containing a role and optional roster player.
A team has one roster and multiple leagues; leagues contain games, expenses,
credits, confirmed settlement payments, and settlement inputs. The API
validates the complete payload before writing it.

## Release checklist

1. Confirm member and treasurer authorization for every changed mutation.
2. Validate request origin, size, IDs, strings, amounts, and references.
3. Add throttling to new login, invitation, write, or destructive endpoints.
4. Run `npm test`, `npm run lint`, and `git diff --check`.
5. Push, package, save, and deploy the exact validated commit through Sites.
6. Smoke-test sign-in, both invitation roles, expense entry, CSV, and logout.
