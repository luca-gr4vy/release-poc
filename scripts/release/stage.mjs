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
    const owner = sh('gh', ['api', `repos/${repo}/git/ref/tags/${tagName}`, '--jq', '.object.sha']);
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
    if (!/already/i.test(output)) throw new Error(`Staging ${tgz} failed`);
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
  'An npm owner approves each with 2FA: `pnpm stage list <package>`, then `pnpm stage approve` (or on npmjs.com).',
].join('\n');
summary(message);
if (pr) sh('gh', ['pr', 'comment', String(pr), '-R', repo, '--body', message]);
