const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
files.push('../App.tsx');

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace text gradients
  content = content.replace(/text-transparent bg-clip-text bg-gradient-to-r from-\[var\(--navy\)\] via-\[var\(--teal\)\] to-amber-800 dark:from-amber-200 dark:via-\[\#FCB824\] dark:to-\[\#ffd15c\]/g, 'text-[var(--gold)]');
  
  // Replace background gradients with amber
  content = content.replace(/to-amber-900\/80/g, 'to-[var(--navy)]');
  content = content.replace(/to-amber-950\/40/g, 'to-[var(--navy)]');
  content = content.replace(/to-amber-950\/50/g, 'to-[var(--navy)]');
  content = content.replace(/dark:to-amber-950\/50/g, 'dark:to-[var(--navy)]');
  content = content.replace(/dark:to-amber-900\/80/g, 'dark:to-[var(--navy)]');
  content = content.replace(/to-amber-200\/30/g, 'to-[var(--gold)]/10');
  
  fs.writeFileSync(filePath, content);
}
console.log("Gradients patched!");
