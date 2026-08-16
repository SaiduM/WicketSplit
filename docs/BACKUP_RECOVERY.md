# WicketSplit backup and recovery

WicketSplit provides a portable, team-level backup for the records that affect
rosters, leagues, games, expenses, credits, payments, and calculated balances.
It deliberately excludes authentication sessions, passwords, team PINs,
membership access, and invitation tokens.

## Routine backup

1. Sign in as a team treasurer and open **Account → Backup & recovery**.
2. Select the team and choose **Download backup**.
3. Store the JSON file in a private location outside WicketSplit.
4. Export after major roster or finance changes and before bulk imports.

Every file contains a schema version, export time, team data, and SHA-256
integrity checksum. A backup is useful only for the same team from which it was
exported.

## Restore

Only the team's original owner can restore a backup. Co-treasurers can export
backups but cannot replace team data.

1. Open **Backup & recovery**, select the affected team, and upload its JSON
   backup.
2. Review the backup date and team name.
3. Type the current team name exactly and confirm the restore.
4. Reload the workspace and verify roster, league, game, expense, credit,
   payment, and balance totals.

The server validates file size, format, team identity, checksum, and every
record reference. It also saves the current team as a private restore point
before applying the uploaded copy. The ten newest restore points per team are
retained in D1 for operator-assisted recovery.

## Recovery checklist

- Stop additional edits while recovery is in progress.
- Record the affected team, approximate incident time, and expected totals.
- Try the most recent known-good downloaded backup first.
- After restore, compare player count, league/game count, ledger count, and CSV
  totals with the expected values.
- If a downloaded backup is unavailable or the restore fails, contact the
  operator through **Report a problem**. Include the team name and approximate
  time, but never send passwords, verification codes, team PINs, or invite
  tokens.

Application restore points are not a substitute for provider-level disaster
recovery. Before broader production scale, add and rehearse a scheduled full-D1
backup procedure in a non-production database.
