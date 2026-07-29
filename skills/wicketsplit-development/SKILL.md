---
name: wicketsplit-development
description: Safely extend, review, test, document, and deploy the WicketSplit cricket expense app. Use for WicketSplit finance calculations, rosters, games, invitations and roles, authentication, D1 persistence, API security, mobile UI, CSV settlement exports, or production releases.
---

# WicketSplit development

Preserve the lightweight expense-tracking purpose and the existing Sites,
Vinext, React, Firebase, and D1 architecture.

## Start

1. Read `README.md`, `.openai/hosting.json`, and directly involved files.
2. Treat the finance and access rules below as invariants.
3. Preserve unrelated user changes.

## Finance invariants

- Split the single league fee by completed-game appearances.
- Split other expenses only among the selected game lineup or custom players.
- Keep payer, participant, credit, and balance calculations explainable.
- Exclude roster-only players without financial activity from exports; retain
  financially active players whose final balance is zero.
- Preserve record IDs when editing names or entries.
- Delete roster players only through the protected API; never silently remove a
  player referenced by access, games, expenses, credits, or participant splits.
- Block game deletion while an expense or credit directly references it; after
  safe deletion, recalculate appearance-based league-fee shares.
- Confirm expense deletion and immediately recalculate all affected balances.
- Keep confirmed settlement payments separate from expenses and credits.
- A confirmed payment increases the sender's balance and decreases the
  receiver's balance; recalculate remaining transfers after every change.
- Never allow a payment to exceed both the sender's remaining debt and the
  receiver's remaining amount due.

## Access invariants

- Require a verified signed-in identity for team data.
- Enforce memberships and roles on the server, never only in the UI.
- Allow members to view and add only expenses they personally paid.
- Allow treasurers to manage setup, entries, credits, and invitations.
- Allow only treasurers to record or delete confirmed settlement payments.
- Restrict whole-team deletion to the original team treasurer and remove the
  shared workspace, memberships, and invitations in one database batch.
- Require an email-bound invitation for co-treasurer access.
- Keep invitation tokens random, hashed, single-use, expiring, and throttled.

## API and data safety

- Authenticate private routes and authorize every team mutation.
- Validate request origin, size, shape, amounts, IDs, and references.
- Add per-account or per-IP throttling to new login, invitation, write, or
  destructive endpoints.
- Use parameterized D1 statements and batches for related writes.
- Keep secrets in Sites environment variables; never commit credentials.
- Treat workspace writes as last-write-wins until versioning is implemented.

## UI rules

- Keep iPhone controls usable without horizontal navigation scrolling.
- Maintain the mobile hamburger drawer and desktop collapsible sidebar.
- Sort player selections alphabetically and provide accessible touch targets.
- Explain role, split, and invitation consequences before confirmation.

## Validate and release

1. Add focused regression assertions.
2. Run `npm test`, `npm run lint`, and `git diff --check`.
3. Update `README.md` when behavior, security, access, setup, or hosting changes.
4. Use Sites building and hosting because `.openai/hosting.json` exists.
5. Push the validated commit, package its exact build, save one version, deploy
   it, and wait for production success.
