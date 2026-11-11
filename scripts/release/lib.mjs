const BUMPS = ['patch', 'minor', 'major'];
const PUBLISHED_DIRS = ['packages/core/', 'packages/react/'];

/** `release` opts in; `minor` / `major` raise the bump; the largest wins. */
export const bumpFromLabels = (labels) => {
  if (!labels.includes('release')) return null;
  return BUMPS.findLast((bump) => bump === 'patch' || labels.includes(bump));
};

export const touchesPublished = (files) =>
  files.some((file) => PUBLISHED_DIRS.some((dir) => file.startsWith(dir)));

/** `lastTag` is `vX.Y.Z` or null (no release yet, base 0.0.0). */
export const nextVersion = (lastTag, bump) => {
  const [major, minor, patch] = (lastTag ?? 'v0.0.0').slice(1).split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

export const renderChangelog = ({ version, date, titles, previous }) => {
  const section = `## ${version} (${date})\n\n${titles.map((title) => `- ${title}`).join('\n')}\n`;
  return previous ? `${section}\n${previous}` : section;
};
