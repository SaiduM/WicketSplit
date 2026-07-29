# WicketSplit

WicketSplit is a lightweight expense and settlement tracker for recreational
cricket teams. It intentionally focuses on one job: record team costs, split
them fairly, and clearly show who should pay whom.

## Product workflow

1. Sign in with Google or a verified phone number and register one or more teams.
2. Add a reusable team roster and create leagues or seasons.
3. Record each game with its date, opponent, and Playing XI or XII.
4. Add expenses, identify who paid, and choose either a game lineup or a custom
   group of players.
5. Record one league fee per league. WicketSplit allocates it by completed-game
   appearances:

   `player share = league fee × player appearances ÷ total appearances`

6. Add credits or waivers for umpiring and other contributions.
7. Review each player's calculation, share the suggested settlement, or export
   the complete ledger as CSV.

## Lightweight feature set

- Multiple teams, rosters, and leagues
- Private player invitation links with shared team access
- Multiple treasurers plus member roles with server-enforced permissions
- Members can view the team and submit expenses they personally paid
- Editable players, leagues, games, expenses, and credits
- Optional game venue and automatic completed status for past dates
- Custom-player and game-lineup expense splits
- One appearance-weighted league fee per league
- Player calculation breakdowns
- Duplicate-expense protection
- Search and filters for finance entries
- Copy-previous-lineup shortcut
- Shareable settlement text and CSV export
- Mobile-friendly PWA installation
- Google OAuth or Firebase phone OTP, per-account D1 persistence, and API rate limiting
- Public Privacy Policy, Terms of Use, and self-service account deletion

WicketSplit deliberately does not include ball-by-ball scoring, player
performance statistics, auctions, tournament brackets, chat, ground booking,
merchandise, or payment processing.

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm test
npm run lint
```

`.openai/hosting.json` contains the Sites project and logical D1 binding.
Production secrets such as Google OAuth credentials are managed through the
hosting environment and must not be committed.

### Firebase phone sign-in

Enable the Phone provider in Firebase Authentication, add the deployed
WicketSplit domain to Firebase Authentication's authorized domains, and add
these production environment values:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`

Firebase sends and verifies the SMS code; WicketSplit receives a verified
Firebase ID token and creates its own secure session. The app never stores the
SMS code. Firebase web configuration is public by design; hosted values may
override the checked-in web defaults. Service-account credentials must never be
committed.

## Data model

Each verified Google or phone identity owns an isolated workspace containing
teams. A team has one roster and multiple leagues. Each league contains games,
expenses, credits, and the information needed to calculate settlement
transfers. The API validates the complete workspace payload before committing
it atomically to D1.
