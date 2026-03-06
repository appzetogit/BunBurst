const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'tmp'];

// Do NOT use global regex instances across loop easily if testing. Use string replace directly to avoid tricky lastIndex issues, or define them locally.
const renameMap = [
  { from: /restaurantId/g, to: 'cafeId' },
  { from: /RestaurantId/g, to: 'CafeId' },
  { from: /restaurant_id/g, to: 'cafe_id' },
  { from: /Restaurant_id/g, to: 'Cafe_id' },
  { from: /restaurants/g, to: 'cafes' },
  { from: /Restaurants/g, to: 'Cafes' },
  { from: /RESTAURANTS/g, to: 'CAFES' },
  { from: /restaurant/g, to: 'cafe' },
  { from: /Restaurant/g, to: 'Cafe' },
  { from: /RESTAURANT/g, to: 'CAFE' },
];

function processDirectory(dir, renameFiles = false) {
  let entries = fs.readdirSync(dir, { withFileTypes: true });

  for (let entry of entries) {
    if (IGNORED_DIRS.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath, renameFiles);
      if (renameFiles && entry.name.toLowerCase().includes('restaurant')) {
        let newName = entry.name;
        newName = newName.replace(/restaurants/g, 'cafes').replace(/Restaurants/g, 'Cafes').replace(/RESTAURANTS/g, 'CAFES')
                         .replace(/restaurant/g, 'cafe').replace(/Restaurant/g, 'Cafe').replace(/RESTAURANT/g, 'CAFE');
        const newPath = path.join(dir, newName);
        fs.renameSync(fullPath, newPath);
        console.log(`Renamed Dir: ${fullPath} -> ${newPath}`);
      }
    } else {
      if (!renameFiles) {
        // Phase 1: File contents replace
        // Skip binary files
        if (entry.name.match(/\.(png|jpg|jpeg|gif|ico|webp|svg|mp4|webm|pdf|eot|ttf|woff|woff2|lock|zip|tar|gz)$/i)) continue;

        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > 5 * 1024 * 1024) continue; // Skip files > 5MB

          let content = fs.readFileSync(fullPath, 'utf8');
          const originalContent = content;

          for (const rule of renameMap) {
            // String.prototype.replace works cleanly with global regex. No test() needed.
            content = content.replace(rule.from, rule.to);
          }

          if (content !== originalContent) {
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`Updated Content: ${fullPath}`);
          }
        } catch (err) {
          console.error(`Skipping file ${fullPath}: ${err.message}`);
        }
      } else {
        // Phase 2: Renaming files
        if (entry.name.toLowerCase().includes('restaurant')) {
          let newName = entry.name;
          newName = newName.replace(/restaurants/g, 'cafes').replace(/Restaurants/g, 'Cafes').replace(/RESTAURANTS/g, 'CAFES')
                           .replace(/restaurant/g, 'cafe').replace(/Restaurant/g, 'Cafe').replace(/RESTAURANT/g, 'CAFE');
          const newPath = path.join(dir, newName);
          fs.renameSync(fullPath, newPath);
          console.log(`Renamed File: ${fullPath} -> ${newPath}`);
        }
      }
    }
  }
}

console.log('--- Phase 1: Replacing File Contents ---');
processDirectory('frontend', false);
processDirectory('backend', false);

console.log('\\n--- Phase 2: Renaming Files and Directories ---');
processDirectory('frontend', true);
processDirectory('backend', true);

console.log('\\nRefactoring Complete!');
