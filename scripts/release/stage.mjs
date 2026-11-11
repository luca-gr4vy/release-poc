// Release steps 5–6: claim the tag, stage each tarball, then create the
// immutable Release and tell people how to approve. Installs nothing.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { RELEASE_JSON, PACKAGES, sh, summary, trySh } from './sh.mjs';

const { GITHUB_REPOSITORY: repo } = process.env;
const { version, sha, pr, distTag, tag, notes = [] } = JSON.parse(readFileSync(RELEASE_JSON, 'utf8'));
const tagName = `v${version}`;

// 1. Claim vX for this commit before staging. The ref create is atomic.
if (tag) {
  const created = trySh('gh', ['api', '-X', 'POST', `repos/${repo}/git/refs`, '-f', `ref=refs/tags/${tagName}`, '-f', `sha=${sha}`]);
  if (created === null) {
    const owner = trySh('gh', ['api', `repos/${repo}/git/ref/tags/${tagName}`, '--jq', '.object.sha']);
    if (owner === null) throw new Error(`Could not create ${tagName} and it doesn't exist: blocked by a tag ruleset or missing contents: write?`);
    if (owner !== sha) throw new Error(`${tagName} is already claimed by ${owner}, not ${sha}`);
    console.log(`${tagName} already claimed by this commit, resuming`);
  }
}

// 2. Stage. "Already staged" is safe here: the claim proves this commit owns the version.
const tarballs = readdirSync('dist').filter((f) => f.endsWith('.tgz'));
for (const tgz of tarballs) {
  const started = Date.now();
  const res = spawnSync('pnpm', ['stage', 'publish', `dist/${tgz}`, '--tag', distTag], { encoding: 'utf8' });
  const output = `${res.stdout}${res.stderr}`;
  console.log(`--- pnpm stage publish ${tgz} (exit ${res.status}, ${Date.now() - started} ms)\n${output}`);
  if (res.status !== 0) {
    // npm answers a re-stage with: [E409] 409 Conflict … Cannot stage previously published version "X"
    if (!/E409|previously published/i.test(output)) throw new Error(`Staging ${tgz} failed`);
    console.log(`::notice::${tgz} was already staged; treating as success`);
  }
}

// 3. The Release makes the tag immutable, so it comes last.
if (tag && trySh('gh', ['release', 'view', tagName, '-R', repo, '--json', 'tagName']) === null) {
  const body = notes.map((t) => `- ${t}`).join('\n') || 'No notes.';
  sh('gh', ['release', 'create', tagName, '-R', repo, '--verify-tag', '--title', tagName, '--notes', body]);
}

// 4. Approve instructions.
const message = [
  `Staged **${version}** (dist-tag \`${distTag}\`) for approval:`,
  '',
  ...PACKAGES.map((p) => `- \`${p.name}@${version}\``),
  '',
  'An npm owner approves each on npmjs.com with 2FA, under the package\'s staged versions. Check the scan has finished first: `pnpm stage list <package>` shows `status: staged`, not `validating`.',
].join('\n');
summary(message);
if (pr) sh('gh', ['pr', 'comment', String(pr), '-R', repo, '--body', message]);
