const fs = require('fs');
let code = fs.readFileSync('src/components/LandingView.tsx', 'utf-8');

const startToken = '{/* Commercial Banner */}';
const endToken = '{/* Primary Navigation Header */}';
let startIndex = code.indexOf(startToken);
let endIndex = code.indexOf(endToken);

if(startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + code.substring(endIndex);
  fs.writeFileSync('src/components/LandingView.tsx', code);
  console.log("Fixed LandingView.tsx banner");
} else {
  console.log("Could not find tokens");
}
