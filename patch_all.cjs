const fs = require('fs');

// 1. Copy logo
fs.copyFileSync('public/Copy_of_Lumen_Academy_Logo.png', 'public/Copy of Lumen Academy_Logo.png');

// 2. Update references to logo
const files = ['src/components/SplashView.tsx', 'src/components/LandingView.tsx', 'src/components/Header.tsx'];
for(let f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  content = content.replace(/\/Lumen_Academy_Logo.png/g, '/Copy of Lumen Academy_Logo.png');
  content = content.replace(/\/Copy_of_Lumen_Academy_Logo_white_text.png/g, '/Copy of Lumen Academy_Logo.png');
  fs.writeFileSync(f, content);
}

// 3. Remove "AI Study Plan" -> "Study Plan"
const spFiles = ['src/components/Header.tsx', 'src/components/LandingView.tsx', 'src/components/CoursesView.tsx', 'src/components/StudyPlanView.tsx'];
for(let f of spFiles) {
  let content = fs.readFileSync(f, 'utf-8');
  content = content.replace(/AI Study Plan/g, 'Study Plan');
  content = content.replace(/AI STUDY PLAN/g, 'STUDY PLAN');
  fs.writeFileSync(f, content);
}

console.log("Patched files");
