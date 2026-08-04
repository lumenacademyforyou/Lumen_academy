const fs = require('fs');

const files = ['src/components/SplashView.tsx', 'src/components/LandingView.tsx', 'src/components/Header.tsx'];
for(let f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  content = content.replace(/\/Copy of Lumen Academy_Logo.png/g, '/Copy_of_Lumen_Academy_Logo_transparent.png');
  fs.writeFileSync(f, content);
}

console.log("Patched files");
