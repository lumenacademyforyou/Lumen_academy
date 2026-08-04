import re

with open('src/index.css', 'r') as f:
    css = f.read()

# Replace global overrides
css = re.sub(r'#0f2537', '#173042', css) # was 031824 originally, I made it 0f2537
css = re.sub(r'#031824', '#173042', css)
css = re.sub(r'#0a2536', '#1c3649', css)
css = re.sub(r'#0c2b3f', '#224056', css)
css = re.sub(r'rgba\(3,24,36,\.72\)', 'rgba(23,48,66,0.85)', css)

# In high-contrast block
css = re.sub(r'--color-surface-dim: #[0-9a-fA-F]+;', '--color-surface-dim: #132a3a;', css)
css = re.sub(r'--color-surface-bright: #[0-9a-fA-F]+;', '--color-surface-bright: #274760;', css)
css = re.sub(r'--color-surface-container-lowest: #[0-9a-fA-F]+;', '--color-surface-container-lowest: #142c3d;', css)
css = re.sub(r'--color-surface-container-low: #[0-9a-fA-F]+;', '--color-surface-container-low: #1a364a;', css)
css = re.sub(r'--color-surface-container: #[0-9a-fA-F]+;', '--color-surface-container: #224056;', css)

# Also #001c2e used in DashboardView, CoursesView etc.
with open('src/index.css', 'w') as f:
    f.write(css)
