import fs from 'fs';

const content = fs.readFileSync('temp.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('aqua-input')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
