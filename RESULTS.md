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

## C: three labelled merges back to back (2026-11-11)

PRs #3 (`minor`), #4 and #5 (patch) were merged at 16:12:57, 16:13:00 and 16:13:03. 0.1.1 was still staged and unapproved.

| Run | PR | Waited in queue | Version | Done |
| --- | --- | --- | --- | --- |
| 43056079482 | #3 | – | 0.2.0 | 16:14:19 |
| 43056086368 | #4 | until 16:14:22 | 0.2.1 | 16:15:31 |
| 43056095438 | #5 | until 16:15:34 | 0.2.2 | 16:17:03 |

- Workflow-level `concurrency` with `queue: max` kept all three runs. None was cancelled, and each saw the previous run's tag.
- **Deploy-gate risk confirmed.** While run 2 was pending, its merge commit had `check-runs total_count: 0`, and `/status` gave `pending` with 0 statuses. No job had started, so no checks existed yet. Any gate that only waits on checks that already exist would pass this commit before its CI runs. Next step: check how Cloud Build `github_checks` treats zero checks.
- Releasing 3 merges took 4m06s, from first merge to last stage. Each queued run waits for the previous one's whole pipeline (about 1m15s each here).
- **Changelog with an unapproved version in between.** Each tarball builds on the latest *public* version (0.1.0). So 0.2.2's CHANGELOG puts #2–#5 in a single `0.2.2` section above the `0.1.0` history, and 0.1.1/0.2.0/0.2.1 get no sections of their own. That's correct if only the newest version is approved. If several are approved in order, their tarballs were built before any approval, so the history between them is folded together.

## C: labels and "release now" (2026-11-11)

- **Label added after merge** (PR #6). The push run logged `No release: PR #6 has no release label`. Adding `release` afterwards started no run, because labelling isn't a trigger here.
- **"Release now"** (`workflow_dispatch`, `bump=patch`) then shipped that change as 0.2.3 with `pr: null`. The approval steps went to the job summary.
- **Label added while CI runs** (PR #7). Merged at 16:20:53, labelled at 16:21:00; `release-pack` started at 16:21:18 and released 0.2.4. Labels are read when `release-pack` starts, not at merge. A label added while `ci`/`scan` are still running counts.
- **"Release now" with nothing new.** After a README-only merge, the dispatch logged `No release: nothing changed in published packages since v0.2.4`.

## C: `v*` tag ruleset (2026-11-11)

- **Personal repos can't use the bypass we want.** A repo ruleset with the GitHub Actions app (id 15368) as bypass actor is rejected: `422 Actor GitHub Actions integration must be part of the ruleset source or owner organization`. So the intended setup ("only Actions may create `v*`") can only be tested in an org. Owner: Org Admin.
- **Mistake during the test.** Because that ruleset wasn't created, two probe tags (`v9.9.9`, `v9.9.8`) were actually created. They were deleted within a minute, before any release ran. Lesson: a stray high `v*` tag would push C's next version to 9.9.10, because C bases versions on the highest tag. In the real repo, a tag ruleset protects against this.
- **Ruleset with no bypass:**
  - The repo owner's tag create via the API was blocked: `422 Reference update failed`.
  - `GITHUB_TOKEN` was blocked too (run 43058121643). The claim failed before staging, so nothing was staged and no version was used. The error was unclear (a 404 from the follow-up lookup); `stage.mjs` now says the tag was blocked.
  - After deleting the ruleset, "re-run failed jobs" released 0.2.5 cleanly. **A failed claim is recoverable.**

## C: prerelease, approval order, reject (2026-11-11)

- **Prerelease** (`workflow_dispatch`, `bump=minor`, `prerelease=true`, run 32): staged `0.3.0-next.32` with `--tag next`, and created no `v*` tag. After approval (16:35Z): `dist-tags = { latest: 0.1.0, next: 0.3.0-next.32 }`. **The staged dist-tag survives approval, and `latest` is untouched.**
- **Approving the newest version first:** approving 0.2.5 (16:36Z) gave `latest: 0.2.5`. react depends on `^0.2.5`.
- **⚠ Approving an older staged version afterwards moves `latest` back.** Approving 0.2.0 (16:37Z) gave `latest: 0.2.0` on both packages, so `npm install` served older code than was already published. The user repaired it with `npm dist-tag add <pkg>@0.2.5 latest` (web 2FA prompt).
  - This applies to every option.
  - Needs a rule: approve only the newest staged version, and reject the older ones.
  - Could also use a guard, e.g. stage older versions under a non-`latest` tag, or have the PR comment warn when a newer version is staged.
- **Reject:** after rejecting 0.2.1 in the npmjs.com UI, it's gone from `pnpm stage list` and isn't public. Not tested: whether 0.2.1 can be staged again. The page says it's used up.
- **Still staged:**
  - 0.1.1 is the expiry check (look again 2026-11-18 and 2026-11-25).
  - 0.2.2–0.2.4 were left on purpose.
