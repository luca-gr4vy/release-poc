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
