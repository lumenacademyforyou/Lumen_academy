import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const componentsDir = path.join(__dirname, 'src/components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
files.push('../App.tsx');

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace colors
  content = content.replace(/bg-\[\#0f172a\]/g, 'bg-[var(--navy)]');
  content = content.replace(/text-\[\#0f172a\]/g, 'text-[var(--navy)]');
  content = content.replace(/border-\[\#0f172a\]/g, 'border-[var(--navy)]');
  
  content = content.replace(/bg-\[\#020617\]/g, 'bg-[var(--navy)]');
  content = content.replace(/text-\[\#020617\]/g, 'text-[var(--navy)]');
  content = content.replace(/border-\[\#020617\]/g, 'border-[var(--navy)]');

  content = content.replace(/bg-\[\#1e3a8a\]/g, 'bg-[var(--teal)]');
  content = content.replace(/text-\[\#1e3a8a\]/g, 'text-[var(--teal)]');
  content = content.replace(/border-\[\#1e3a8a\]/g, 'border-[var(--teal)]');
  
  content = content.replace(/bg-\[\#172554\]/g, 'bg-[var(--teal-2)]');
  content = content.replace(/hover:bg-\[\#172554\]/g, 'hover:bg-[var(--teal-2)]');

  content = content.replace(/amber-500/g, '[\#FCB824]');
  content = content.replace(/amber-400/g, '[\#FCB824]');
  content = content.replace(/amber-600/g, '[\#ffd15c]');
  content = content.replace(/amber-300/g, '[\#FCB824]');
  
  content = content.replace(/slate-900/g, '[\#00243B]');
  content = content.replace(/slate-800/g, '[\#00243B]');
  
  fs.writeFileSync(filePath, content);
}
console.log("Colors replaced!");
