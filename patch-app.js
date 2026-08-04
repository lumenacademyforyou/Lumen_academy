const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  'import LandingView from "./components/LandingView";',
  'import LandingView from "./components/LandingView";\nimport SplashView from "./components/SplashView";'
);

content = content.replace(
  'export default function App() {\n  const [isAuthenticated, setIsAuthenticated] = useState(false);',
  'export default function App() {\n  const [hasSeenSplash, setHasSeenSplash] = useState(false);\n  const [isAuthenticated, setIsAuthenticated] = useState(false);'
);

content = content.replace(
  '  if (!isAuthenticated) {',
  '  if (!hasSeenSplash) {\n    return <SplashView onEnter={() => setHasSeenSplash(true)} />;\n  }\n\n  if (!isAuthenticated) {'
);

fs.writeFileSync('src/App.tsx', content);
