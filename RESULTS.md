# Results

Live observations from running the release options. One section per check: what was run, raw output, date.

## First publish of a new package creates a `0.0.0-stage` placeholder (2026-11-11)

- Run: `pnpm publish --access public` (pnpm 11.28.9), web login + 2FA, no stage or trusted-publisher settings configured beforehand.
- Both commands printed `✅ Published package …@0.0.0`.
- npm first created a public version `0.0.0-stage` ("Temporary package placeholder for staged publishing", `dist-tags.latest` pointing at it). The real `0.0.0` replaced it as `latest` later:

| Package | `0.0.0-stage` | `0.0.0` | Gap |
| --- | --- | --- | --- |
| `@luca-gr4vy/release-poc` | 14:05:26Z | 14:07:34Z | 2m08s |
| `@luca-gr4vy/release-poc-react` | 14:05:43Z | 14:07:00Z | 1m17s |

- Core's packument returned `404` from the registry until about 14:10Z, three minutes after its `0.0.0` timestamp. react's showed up sooner.
- `pnpm stage list` showed nothing staged for either package during the gap.
- Takeaways:
  - A plain publish now seems to go through a staging or scan step too.
  - Each new package keeps a stray `0.0.0-stage` version.
  - "Published" in the CLI doesn't mean installable yet.

## C: first labelled release, 0.1.0 (2026-11-11)

PR #1 (`feat(core): …`, labels `release` + `minor`) was squash-merged at 16:00:01Z. Run 43053893058 then did the following:

| Step | Time (UTC) | Result |
| --- | --- | --- |
| `decide` | 16:00:24 | `{ version: '0.1.0', pr: 1 }`, base: no `v*` tag |
| `pack` | 16:00:30 | Changelog: 3 titles since public `0.0.0`, which has no CHANGELOG |
| claim `v0.1.0` | 16:00:50 | ref created at the merge commit |
| `pnpm stage publish` core | 16:00:54 | exit 0 in 5.0 s, id `65209a37…`, "staged by: GitHub Actions (trusted automation)" |
| `pnpm stage publish` react | 16:00:59 | exit 0 in 4.5 s, id `15fb3e54…` |
| Release `v0.1.0` + PR comment | 16:01:00 | `isImmutable: true` |
| npm scan done | by 16:02:30 | `pnpm stage view` status went from `validating` to `staged` |
| user approval (2FA) | 16:03:10 / 16:03:17 | `dist-tags.latest = 0.1.0`; react depends on `^0.1.0` |

Findings:
- **OIDC works with `pnpm stage publish`** (pnpm 11.28.9), through a stage-only trusted publisher bound to environment `release`. No npm CLI was needed. It also validated the "Pending validation" trusted-publisher config.
- **Malware scan:** stage publish returns straight away and doesn't wait for the scan. The scan took no more than ~1.5 min (polled every 15 s). During the scan, `pnpm stage view <id> --json` shows `"status": "validating"`, then `"staged"`.
- **The approved version's `_npmUser` is "GitHub Actions"**, not the approver.
- **Provenance was attached anyway:** an SLSA v1 provenance attestation plus npm's publish attestation, despite `npm_config_provenance=false`. pnpm or npm seems to add provenance automatically for trusted publishing from a public repo. The private target repo can't produce provenance, so this doesn't carry over.
- After approval, `pnpm stage list` shows nothing staged.

## C: re-runs (2026-11-11)

- **Re-run of a released commit.** Run 43053893058, attempt 2: `No release: v0.1.0 is already released at HEAD`. No new tag, `release-stage` skipped.
- **Re-staging a staged version.** 0.1.1 was staged (run 43055078419, PR #2, not approved), then only `release-stage` was re-run. The tag claim resumed (`v0.1.1 already claimed by this commit, resuming`). npm refused the stage after 10 s:
  `[E409] 409 Conflict - POST https://registry.npmjs.org/-/stage/package/@luca-gr4vy%2frelease-poc - Cannot stage previously published version "0.1.1".`
  - The message says "previously published", not "already staged", even though 0.1.1 was never public. The script was matching `/already/` and failed. It now matches `E409|previously published`.
  - **A re-run uses the scripts from the original commit**, so a fix to a release script only applies from the next merge. That attempt stays red.
