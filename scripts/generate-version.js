import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if --force flag is passed
const isForce = process.argv.includes('--force');

const versionData = {
  version: Date.now(),
  forceUpdate: isForce
};

const outputPath = path.join(__dirname, '..', 'public', 'version.json');

fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));

console.log(`\x1b[32m✔ Generated version.json\x1b[0m (forceUpdate: ${isForce})`);
