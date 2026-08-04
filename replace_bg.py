import re

with open('src/index.css', 'r') as f:
    css = f.read()

# Replace hardcoded dark mode backgrounds for better visibility
css = re.sub(r'background-color: #0f172a !important;', 'background-color: #213c54 !important;', css)
css = re.sub(r'background-color: #1e293b !important;', 'background-color: #2a4c68 !important;', css)

with open('src/index.css', 'w') as f:
    f.write(css)
