---
name: wicketsplit-development
description: Safely extend, review, test, document, and deploy the WicketSplit cricket expense app. Use for WicketSplit finance calculations, rosters, games, invitations and roles, authentication, D1 persistence, API security, mobile UI, CSV settlement exports, or production releases.
---

# WicketSplit development

Preserve the lightweight expense-tracking purpose and the existing Sites,
Vinext, React, Firebase, and D1 architecture.

## Start

1. Read `README.md`, `.openai/hosting.json`, and directly involved files.
2. Read `docs/HLD.md` for system boundaries, `docs/LLD.md` for formulas and
   persistence rules, and `docs/FUTURE_TODO.md` before changing architecture.
3. Treat the finance and access rules below as invariants.
4. Preserve unrelated user changes.

## Finance invariants

- Add League Fee, Fruits / Water, IV, and all umpiring credits to the
  game-funded cost pool. Split each entry equally across completed games with
  eligible players, then divide each game's portion equally among that game's
  eligible players. Sum each player's per-game shares.
- Keep the persisted `appearances` split value only for backward compatibility;
  do not restore constant-per-appearance allocation.
- For Restaurant and Other expenses, offer the existing by-game calculation or
  custom players. Do not add a separate game-lineup split.
- Keep payer, participant, credit, and balance calculations explainable.
- Treat umpiring as a funded team credit: enter one fixed rate, record outside
  game counts for any/all players in a batch, and save only non-zero rows. Give
  each umpire the full `games × rate` credit, add the full credited amount to
  the game-funded cost pool, and never cap it at the player's amount owed.
- Do not attach umpiring to a WicketSplit game, payer, funding group, or
  user-entered date. Retain the legacy `umpiring-waiver` kind only for storage
  compatibility.
- Exclude roster-only players without financial activity from exports; retain
  financially active players whose final balance is zero.
- Preserve record IDs when editing names or entries.
- Delete roster players only through the protected API; never silently remove a
  player referenced by access, games, expenses, credits, or participant splits.
- Block game deletion while an expense or credit directly references it; after
  safe deletion, recalculate all equal-per-game shares.
- Confirm expense deletion and immediately recalculate all affected balances.
- Keep confirmed settlement payments separate from expenses and credits.
- Show the full settlement equation and itemized positive contributions in the player Details view; never hide expenses paid or umpiring credits inside the remaining balance.
- Keep the player calculator summary compact: combine expense categories into one share and show umpiring credit and net share without weight or umpiring-count columns.
- A confirmed payment increases the sender's balance and decreases the
  receiver's balance; recalculate remaining transfers after every change.
- Never allow a payment to exceed both the sender's remaining debt and the
  receiver's remaining amount due.

## Access invariants

- Require a verified signed-in identity for team data.
- Enforce memberships and roles on the server, never only in the UI.
- Keep the combined Team users inventory authenticated-treasurer-only; return sanitized access metadata and never PINs, access tokens, encrypted access secrets, or their hashes.
- Allow members to view financial records but require a treasurer or co-treasurer to add new expenses.
- Allow treasurers to manage setup, entries, credits, and invitations.
- Allow only treasurers to record or delete confirmed settlement payments.
- Restrict whole-team deletion to the original team treasurer and remove the
  shared workspace, memberships, and invitations in one database batch.
- Require an email-bound invitation for co-treasurer access.
- Allow one verified email to hold memberships in multiple teams and expose
  them through the Current Team selector.
- Keep invitation tokens random, hashed, single-use, expiring, and throttled.

## API and data safety

- Authenticate private routes and authorize every team mutation.
- Validate request origin, size, shape, amounts, IDs, and references.
- Add per-account or per-IP throttling to new login, invitation, write, or
  destructive endpoints.
- Use parameterized D1 statements and batches for related writes.
- Keep secrets in Sites environment variables; never commit credentials.
- Preserve optimistic team versions: reject stale writes with HTTP 409 and keep
  the reload-latest recovery action visible to the user.
- Treat indexed `workspace_*` records as authoritative and keep `shared_teams`
  only as the synchronized compatibility/rollback snapshot.
- Keep the 256 KB full-workspace request limit and current collection limits in
  mind; do not claim large-scale readiness without load testing.

## UI rules

- Keep iPhone controls usable without horizontal navigation scrolling.
- Maintain the mobile hamburger drawer and desktop collapsible sidebar.
- Preserve browser history for section navigation, the mobile Back control, and
  the guarded left-edge swipe gesture without intercepting normal scrolling.
- Sort player selections alphabetically and provide accessible touch targets.
- Preserve bounded pagination for game history (12 per page) and the finance
  ledger (20 per filtered page), including mobile-friendly controls.
- Keep lineup entry simple: selected XI/XII players share by default, keep
  exclusions behind an optional adjustment, and do not ask users to reselect
  players when adding a game-funded expense.
- Explain role, split, and invitation consequences before confirmation.
- Render the workspace loading/error guards before new-account registration so
  existing users never see an empty setup or team-selection flash during sync.
- Use `Split equally by game · N completed games` consistently for all
  game-funded expenses and umpiring credits.
- Keep Home personal to the roster player linked to the signed-in account;
  team-wide finance summaries belong in Settlement, Expenses, and Calculator.

## Validate and release

1. Add focused regression assertions.
2. Run `npm test`, `npm run lint`, and `git diff --check`.
3. Update `README.md` when behavior, security, access, setup, or hosting changes.
4. Use Sites building and hosting because `.openai/hosting.json` exists.
5. Push the validated commit and package/save the exact commit as one Sites
   version. Deploy only with explicit approval for the public site, then wait
   for production success.
