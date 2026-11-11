// Release step 1–2: decide whether this commit releases, and which version.
// Runs before `pnpm install`, so non-release pushes free the release queue fast.
// Writes dist/release.json and the `release` step output.
import { mkdirSync, writeFileSync } from 'node:fs';
import { bumpFromLabels, nextVersion, touchesPublished } from './lib.mjs';
import { RELEASE_JSON, setOutput, sh, trySh } from './sh.mjs';

const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GITHUB_EVENT_NAME: event, GITHUB_RUN_NUMBER: run } = process.env;
const isDispatch = event === 'workflow_dispatch';
const prerelease = process.env.INPUT_PRERELEASE === 'true';

const skip = (reason) => {
  console.log(`No release: ${reason}`);
  setOutput('release', 'false');
  process.exit(0);
};

const stableTags = (args) => sh('git', ['tag', '--list', 'v*', ...args]).split('\n').filter((t) => t && !t.includes('-'));

const findPr = () => {
  const number = sh('gh', ['api', `repos/${repo}/commits/${sha}/pulls`, '--jq', '.[0].number // empty']);
  if (!number) return null;
  const { labels, files } = JSON.parse(sh('gh', ['pr', 'view', number, '-R', repo, '--json', 'labels,files']));
  return { number: Number(number), labels: labels.map((l) => l.name), files: files.map((f) => f.path) };
};

const write = (release) => {
  mkdirSync('dist', { recursive: true });
  writeFileSync(RELEASE_JSON, `${JSON.stringify({ ...release, sha }, null, 2)}\n`);
  console.log('Release:', release);
  setOutput('release', 'true');
};

const highest = stableTags(['--sort=-v:refname'])[0] ?? null;
const tagAtHead = prerelease ? undefined : stableTags(['--points-at', 'HEAD'])[0];

// A claimed tag at HEAD: done if its Release exists, otherwise resume that version.
if (tagAtHead) {
  if (trySh('gh', ['release', 'view', tagAtHead, '-R', repo, '--json', 'tagName']) !== null) {
    skip(`${tagAtHead} is already released at HEAD`);
  }
  const pr = isDispatch ? null : findPr();
  write({ version: tagAtHead.slice(1), pr: pr?.number ?? null, distTag: 'latest', tag: true, resume: true });
  process.exit(0);
}

// Old or out-of-order run: HEAD is already contained in a released version.
if (highest && trySh('git', ['merge-base', '--is-ancestor', 'HEAD', highest]) !== null) {
  skip(`HEAD is already contained in ${highest} (stale run)`);
}

let bump;
let pr = null;
if (isDispatch) {
  bump = process.env.INPUT_BUMP;
  const files = sh('git', highest ? ['diff', '--name-only', `${highest}..HEAD`] : ['ls-files']).split('\n');
  if (!touchesPublished(files)) skip(`nothing changed in published packages since ${highest}`);
} else {
  pr = findPr();
  if (!pr) skip(`no PR for ${sha}`);
  bump = bumpFromLabels(pr.labels);
  if (!bump) skip(`PR #${pr.number} has no release label`);
  if (!touchesPublished(pr.files)) skip(`PR #${pr.number} touches no published package`);
}

const version = nextVersion(highest, bump);
write(
  prerelease
    ? { version: `${version}-next.${run}`, pr: pr?.number ?? null, distTag: 'next', tag: false }
    : { version, pr: pr?.number ?? null, distTag: 'latest', tag: true },
);
