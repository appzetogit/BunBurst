const fs = require('fs');
const path = require('path');

const directories = [
  path.join(process.cwd(), 'frontend', 'src'),
  path.join(process.cwd(), 'backend')
];

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        processDirectory(filePath);
      }
    } else if (extensions.includes(path.extname(file))) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Regex to match console.log(...) and handle potential multi-line, though risky.
      // A safer one is to match console.log on a single line first or use a non-greedy multiline.
      // But usually console logs in this project seem to be standard.

      // This regex matches console.log followed by anything until the closing parenthesis and semicolon
      // It tries to handle nested parentheses simplified way.
      const logRegex = /console\.log\s*\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\)\s*;?/g;

      if (logRegex.test(content)) {
        console.log(`Removing logs from: ${filePath}`);
        const newContent = content.replace(logRegex, '');
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
    }
  });
}

directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`Processing directory: ${dir}`);
    processDirectory(dir);
  } else {
    console.log(`Directory not found: ${dir}`);
  }
});
