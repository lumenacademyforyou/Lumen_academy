const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf-8');

code = code.replace(/<span[^>]*>\s*AI PROCTORED TESTING\s*<\/span>/g, '');

fs.writeFileSync('src/components/Header.tsx', code);
