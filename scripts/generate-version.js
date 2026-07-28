import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const isForce = process.argv.includes('--force');

const git = (cmd, fallback = '') => {
  try { return execSync(cmd, { cwd: rootDir }).toString().trim(); }
  catch { return fallback; }
};

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.0.0';
const build = Number(git('git rev-list --count HEAD', '0')) || 0;
const commit = git('git rev-parse --short HEAD', 'nogit');
const builtAt = new Date().toISOString();

const versionData = { version, build, commit, builtAt, forceUpdate: isForce };

fs.writeFileSync(
  path.join(rootDir, 'public', 'version.json'),
  JSON.stringify(versionData, null, 2)
);

// Big banner in the Netlify build log so the deploy card is trivially scannable.
const line = '═'.repeat(52);
console.log(`\n\x1b[36m${line}\x1b[0m`);
console.log(`\x1b[36m  🚀 AquaDealer  v${version}  build #${build}  ${commit}\x1b[0m`);
console.log(`\x1b[36m  built ${builtAt}${isForce ? '  (force reload)' : ''}\x1b[0m`);
console.log(`\x1b[36m${line}\x1b[0m\n`);
