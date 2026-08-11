# WicketSplit product review

## Overall shape

WicketSplit is a focused, feedback-ready team expense product. It covers the
complete loop from roster and game attendance through expense allocation,
team-funded umpiring credits, repayment, and CSV reporting. It intentionally does not try
to be a cricket scoring platform, chat app, or payment processor.

The strongest product decision is role separation: treasurers manage the
ledger through individual accounts, while ordinary players use a reusable
private team link and PIN. This keeps administration accountable without
forcing every player to register.

## Functional coverage

- Multiple teams, treasurers, rosters, and leagues
- Manual games, CricClubs synchronization, and reviewed squad-screenshot import
- Equal-per-game League Fee and Fruits / Water expenses, divided among each game’s eligible players
- Per-game eligibility overrides that preserve the recorded lineup while
  removing selected appearances from weighted costs
- A simplified lineup form includes everyone by default and hides exclusions
  behind an optional adjustment; game-funded expense forms require no second
  player-selection step
- Per-game Calculator and CSV breakdowns showing the allocation that drives balances
- Custom or games-played sharing for Restaurant and Other expenses
- Player-submitted expenses with submitter-only editing and deletion
- Batch team-funded umpiring credits, player calculation breakdowns, and CSV export
- Suggested transfers plus a confirmed repayment audit trail
- Reusable team-member access that can be replaced or revoked
- Treasurer-only access inventory for authenticated treasurers, active shared-player sessions, and pending invitations

## Access model

| Role | Entry | Main capabilities |
| --- | --- | --- |
| Owner/treasurer | Individual Google or verified email sign-in | Full team and financial administration |
| Co-treasurer | Email-restricted invitation, then individual sign-in | Full team administration; removable by another treasurer |
| Team player | Private team link + six-digit PIN; no account | Personal Home, Games, Expenses, and own expense maintenance |

Shared player access is convenient, but it is not strong identity proof. Anyone
with both team secrets can select a roster identity, so teams should share the
message only in a trusted group and replace access if it leaks.

## Navigation and mobile experience

Treasurers see Home, Team roster, Leagues, Games, Expenses, Calculator, and
Settlement. Players see only Home, Games, and Expenses. The Home page is
personal to the selected roster identity and emphasizes what that person owes
or receives and the games they played.

On phones, navigation uses a compact menu, an on-screen Back action, and a
guarded left-edge swipe. Games and roster cards use two columns where space
allows. Expense, balance, and payment-history tables become stacked labeled
cards so users do not need to scroll sideways. Save failures expose a direct
retry action instead of leaving a passive error label.

## Security and data handling

Server routes enforce authenticated roles; browser state is not trusted for
authorization. Sessions use secure signed cookies, mutation routes reject
cross-origin requests, sensitive tokens are hashed or encrypted, inputs are
validated and size-limited, and rate limits protect sign-in, invitations,
workspace reads, and writes. D1 provides transactional operations for the
relational access and rate-limit records.

Screenshots used for squad import are processed in the browser and are not
stored. WicketSplit calculates and records money movement but never holds or
transfers funds.

## Known limits

- Concurrent workspace edits use last-write-wins; two treasurers should avoid
  changing the same team at the same instant.
- CricClubs import depends on an external public feed and may need manual entry
  if that service changes or becomes unavailable.
- The current storage and operating model suits club-team feedback and normal
  recreational use, not large organizations or regulated financial records.
- Production monitoring, alerting, tested backups, and an independent security
  review remain appropriate before materially increasing scale or data value.
- First-load workspace state is guarded so existing users see synchronization,
  never a temporary empty registration or team-selection screen.

## Recommended next priorities

1. Collect feedback from a small number of real teams before adding scope.
2. Add error monitoring and a tested backup/restore procedure.
3. Add optimistic workspace versions before encouraging simultaneous
   co-treasurer entry.
4. Normalize financial records and add pagination before broad public growth.
5. Keep scoring, chat, and payment processing outside the core unless repeated
   user evidence shows they are necessary. See `FUTURE_TODO.md` for the full
   ordered backlog.
