const fs = require('fs');
const path = require('path');

const DIRECTORIES_TO_IGNORE = [
  'node_modules', 
  'dist', 
  '.git', 
  '.lovable', 
  'supabase', 
  '.agents', 
  '.code-review-graph', 
  'test-results', 
  'tests'
];
const EXTENSIONS_TO_CHECK = ['.ts', '.tsx', '.js', '.jsx', '.html', '.json', '.md', '.css'];

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!DIRECTORIES_TO_IGNORE.includes(file)) {
        walk(filePath, fileList);
      }
    } else {
      if (EXTENSIONS_TO_CHECK.includes(path.extname(filePath))) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = walk(__dirname);
let changedFilesCount = 0;

for (const file of allFiles) {
  if (file.endsWith('replace-name.cjs')) continue;

  const content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  // Replace "Aqua Dealers" -> "AquaDealers"
  newContent = newContent.replace(/Aqua Dealers/g, 'AquaDealers');
  // Replace "aqua dealers" -> "aquadealers"
  newContent = newContent.replace(/aqua dealers/g, 'aquadealers');
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFilesCount++;
    console.log('Updated:', file.replace(__dirname, ''));
  }
}

console.log('Total files changed:', changedFilesCount);
