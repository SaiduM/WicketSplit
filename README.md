# WicketSplit

WicketSplit is a lightweight expense and settlement tracker for recreational
cricket teams. It records team costs, splits them fairly, and clearly shows who
should pay whom.

## Architecture documentation

- [High-level design](docs/HLD.md)
- [Low-level design](docs/LLD.md)

## Production

The public production site is:

<https://wicketsplit-wolfpacks.saidubabumallela.chatgpt.site>

It can be shared for real-team feedback. Feedback users should use test-sized
amounts until the team agrees on its roster and access roles. WicketSplit
calculates settlements but does not move money.

## Product workflow

1. Sign in with Google or a verified Firebase email/password account.
2. Register one or more teams, add a reusable roster, and create leagues.
3. Record games with the date, opponent, and Playing XI or XII.
4. Add expenses using one of four categories: Fruits / Water, League Fee,
   Restaurant, or Other. League Fee and Fruits / Water are allocated by
   completed-game appearances:

   `player share = expense × player appearances ÷ total appearances`

5. Choose custom players or a games-played split for Restaurant and Other.
6. Use the Calculator to review appearances, weights, and each cost component.
7. Record umpiring credits by selecting the player and completed game, then
   entering the agreed amount per umpiring assignment. The game date and lineup
   are attached automatically.
8. Share the suggested transfers showing who should pay whom.
9. After the receiver confirms money arrived, record the settlement payment.
   Remaining balances and transfer suggestions recalculate automatically.
10. Review the payment audit history or export the complete ledger as CSV.

## Lightweight feature set

- Multiple teams, rosters, leagues, and treasurers
- Server-enforced treasurer and team-member roles
- Account dropdown showing team-specific name, role, email, and roster phone
- Editable players, games, expenses, credits, and leagues
- Safe roster deletion for unused players; historical or access-linked players are protected
- Owner-only team deletion removes the shared workspace, memberships, and outstanding invites
- Treasurer controls to delete unlinked games and expenses with confirmation and automatic balance recalculation
- Custom-player and games-played splits
- Four expense categories: Fruits / Water, League Fee, Restaurant, and Other
- Appearance-weighted league fees and refreshment costs
- League calculator showing games played, percentage weight, and cost components
- Structured umpiring credits with duplicate prevention, game details, per-player
  umpiring counts, and total credit earned
- Player calculation breakdowns, filters, duplicate protection, and CSV export
- Confirmed repayment ledger with received date, sender, receiver, amount,
  optional reference, remaining balances, and overpayment protection
- Mobile-friendly PWA installation and responsive navigation
- Google or Firebase email authentication with D1 persistence
- Public Privacy Policy, Terms of Use, and self-service account deletion

WicketSplit deliberately excludes scoring, statistics, auctions, brackets,
chat, bookings, merchandise, and payment processing.

## Team access and invitations

Only a current treasurer can create an invitation:

1. Add or edit the person in **Team roster**. Add their email whenever possible.
2. Select **Invite** on their roster card.
3. Choose **Team member** or **Co-treasurer**.
4. Create the invitation, review the exact prepared message, copy it, and send
   it through your preferred messaging or email app.

Roles are enforced by the server:

- **Team member:** can view shared records and submit a new expense only when
  that roster player is the payer. Members cannot change the roster, leagues,
  games, credits, existing expenses, or invitations.
- **Co-treasurer:** has full team-management access. These invitations require
  a roster email and can only be accepted by that verified email identity.

Invitation links contain a 256-bit random bearer token. Only its SHA-256 hash is
stored. Links are single-use, expire after seven days, and a new invitation
replaces the previous unused invitation for that player. Member links without
an email are bearer links: anyone who receives one can accept it, so share them
privately. Prepared invite text states the team, role, permissions, expiration,
and required email when applicable.

## Settlement payments

Expenses and credits calculate the original player balances. Repayments are
stored separately so expense history is never rewritten:

`remaining balance = original balance + payments sent − payments received`

The Settlement page continuously suggests who should pay whom based on the
remaining balances. A treasurer records a payment only after the receiver
confirms it arrived. The form limits the amount to both the sender's remaining
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
  in workspace JSON.
- Referrer data is disabled to avoid forwarding invitation tokens.

These controls are appropriate for a lightweight feedback release. They do not
replace an independent penetration test, monitoring and alerting, tested
backups, or a compliance review if regulated or high-value data is introduced.
Concurrent workspace edits remain last-write-wins, so multiple treasurers
should avoid editing the same team at exactly the same time.

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm test
npm run lint
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
