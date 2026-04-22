with open('scripts/vercel-install.sh', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if line.startswith('rm -rf .bookiji-tmp'):
        new_lines.append('''
if [ -d monorepo-packages ] && [ -f monorepo-packages/ai-runtime/package.json ]; then
  echo "monorepo-packages already exists (e.g. checked out by CI or local). Skipping clone."
else
''')
        new_lines.append(line)
        skip = True
    elif skip and line.startswith('rm -rf monorepo-packages'):
        skip = False
        new_lines.append(line)
    elif skip and line.startswith('cp -a .bookiji-packages monorepo-packages'):
        new_lines.append(line)
        new_lines.append('fi\n')
    else:
        new_lines.append(line)

with open('scripts/vercel-install.sh', 'w') as f:
    f.writelines(new_lines)
