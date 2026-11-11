// Release steps 3–4: set the version in the CI workspace only, build each
// package's CHANGELOG.md, and pack the tarballs into dist/.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderChangelog } from './lib.mjs';
import { PACKAGES, RELEASE_JSON, sh, trySh } from './sh.mjs';

const release = JSON.parse(readFileSync(RELEASE_JSON, 'utf8'));
const date = new Date().toISOString().slice(0, 10);

// Latest *public* version and its CHANGELOG.md. Staged versions are invisible here.
const publicChangelog = async (name) => {
  const res = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2f')}`);
  if (!res.ok) return { version: null, changelog: '' };
  const doc = await res.json();
  const version = doc['dist-tags'].latest;
  const tgz = join(process.env.RUNNER_TEMP ?? tmpdir(), `${name.replace(/[@/]/g, '_')}-${version}.tgz`);
  writeFileSync(tgz, Buffer.from(await (await fetch(doc.versions[version].dist.tarball)).arrayBuffer()));
  return { version, changelog: trySh('tar', ['-xzOf', tgz, 'package/CHANGELOG.md']) ?? '' };
};

const titlesSince = (version) => {
  const tag = version && trySh('git', ['rev-parse', '--verify', '--quiet', `v${version}`]) ? `v${version}..HEAD` : 'HEAD';
  return sh('git', ['log', tag, '--format=%s', '--', ...PACKAGES.map((p) => p.dir)])
    .split('\n')
    .filter(Boolean);
};

let notes = [];
for (const { name, dir } of PACKAGES) {
  const manifestPath = join(dir, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, version: release.version }, null, 2)}\n`);

  const previous = await publicChangelog(name);
  const titles = titlesSince(previous.version);
  console.log(`${name}: ${release.version}, ${titles.length} titles since public ${previous.version}`);
  writeFileSync(
    join(dir, 'CHANGELOG.md'),
    renderChangelog({ version: release.version, date, titles, previous: previous.changelog }),
  );
  if (titles.length > notes.length) notes = titles;
}

writeFileSync(RELEASE_JSON, `${JSON.stringify({ ...release, notes }, null, 2)}\n`);
console.log(sh('pnpm', ['-r', '--filter', './packages/*', 'pack', '--pack-destination', 'dist']));
