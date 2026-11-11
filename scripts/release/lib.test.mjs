import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bumpFromLabels, touchesPublished, nextVersion, renderChangelog } from './lib.mjs';

test('bumpFromLabels', () => {
  for (const [labels, expected] of [
    [[], null],
    [['minor'], null],
    [['release'], 'patch'],
    [['release', 'minor'], 'minor'],
    [['release', 'minor', 'major'], 'major'],
  ]) {
    assert.equal(bumpFromLabels(labels), expected, JSON.stringify(labels));
  }
});

test('touchesPublished', () => {
  for (const [files, expected] of [
    [['README.md', '.github/x'], false],
    [['packages/internal/x'], false],
    [['packages/core-extra/x'], false],
    [['packages/react/index.js'], true],
    [['README.md', 'packages/core/index.js'], true],
  ]) {
    assert.equal(touchesPublished(files), expected, JSON.stringify(files));
  }
});

test('nextVersion', () => {
  for (const [lastTag, bump, expected] of [
    [null, 'minor', '0.1.0'],
    ['v0.1.0', 'patch', '0.1.1'],
    ['v0.1.1', 'major', '1.0.0'],
    ['v1.2.3', 'minor', '1.3.0'],
  ]) {
    assert.equal(nextVersion(lastTag, bump), expected, `${lastTag} ${bump}`);
  }
});

test('renderChangelog puts the new section on top of the previous one', () => {
  const previous = '## 0.1.0 (2026-11-10)\n\n- feat: first\n';
  assert.equal(
    renderChangelog({ version: '0.2.0', date: '2026-11-11', titles: ['feat: a', 'fix: b'], previous }),
    `## 0.2.0 (2026-11-11)\n\n- feat: a\n- fix: b\n\n${previous}`,
  );
});

test('renderChangelog with no previous changelog', () => {
  assert.equal(
    renderChangelog({ version: '0.1.0', date: '2026-11-11', titles: ['feat: a'], previous: '' }),
    '## 0.1.0 (2026-11-11)\n\n- feat: a\n',
  );
});
