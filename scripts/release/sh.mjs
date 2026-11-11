import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();

export const trySh = (cmd, args) => {
  try {
    return sh(cmd, args);
  } catch {
    return null;
  }
};

export const setOutput = (name, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
};

export const summary = (markdown) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
};

export const RELEASE_JSON = 'dist/release.json';
export const PACKAGES = [
  { name: '@luca-gr4vy/release-poc', dir: 'packages/core' },
  { name: '@luca-gr4vy/release-poc-react', dir: 'packages/react' },
];
