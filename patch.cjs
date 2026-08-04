const fs = require('fs');
let code = fs.readFileSync('src/components/LandingView.tsx', 'utf-8');

code = code.replace(/<button\s+onClick={handleOpenRegister}[\s\S]*?New Aspirant Signup\s+<\/button>/g, '');
code = code.replace(/<button\s+onClick={handleOpenLogin}[\s\S]*?Student Portal\s+<\/button>/g, '');
code = code.replace(/<span[^>]*>\s*AI PROCTORED TESTING PORTAL\s*<\/span>/g, '');

fs.writeFileSync('src/components/LandingView.tsx', code);
