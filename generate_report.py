import os
import re

def is_markdown(filename):
    return filename.endswith('.md')

def get_markdown_files():
    md_files = []
    for root, dirs, files in os.walk('.'):
        if 'node_modules' in root.split(os.sep) or '.git' in root.split(os.sep):
            continue
        for file in files:
            if is_markdown(file):
                md_files.append(os.path.join(root, file).replace('./', '', 1))
    return sorted(md_files)

# Scope
# Products currently in scope: Bookiji, Kinetix, MyAssist, MyChessCoach
# Expected structure:
# root-level docs
# docs/ folders
# standards/policy folders
# package-level docs
# architecture and audit docs
# README files
# product-specific operational docs
# deployment docs
# billing/docs/standards docs

products = ['Bookiji', 'Kinetix', 'MyAssist', 'MyChessCoach']
major_topics = ['billing', 'architecture', 'platform standards', 'execution plans', 'backlog', 'deployment', 'auth', 'help center', 'product strategy']

md_files = get_markdown_files()

missing = []
duplicates = []
drift = []
broken_refs = []
canonical_issues = []
cleanup = []

def add_issue(issue_list, severity, scope, paths, explanation, action):
    issue_list.append({
        'severity': severity,
        'scope': scope,
        'paths': paths,
        'explanation': explanation,
        'action': action
    })

# 1. Inventory Summary (grouped by type)
groups = {
    'root': [],
    'shared package': [],
    'product': {p: [] for p in products},
    'docs type': {
        'README': [], 'architecture': [], 'standard': [], 'runbook': [], 'audit': [], 'roadmap': [], 'billing': [], 'deployment': [], 'testing': [], 'other': []
    }
}

product_folders = {
    'Bookiji': 'products/Bookiji',
    'Kinetix': 'products/Kinetix',
    'MyAssist': 'products/MyAssist',
    'MyChessCoach': 'products/MyChessCoach',
}

for f in md_files:
    # Grouping
    if '/' not in f:
        groups['root'].append(f)
    elif f.startswith('packages/') or f.startswith('monorepo-packages/'):
        groups['shared package'].append(f)

    product_assigned = False
    for p, folder in product_folders.items():
        if f.startswith(folder) or p.lower() in f.lower():
            groups['product'][p].append(f)
            product_assigned = True
            break

    # Simple typing based on name/path
    f_lower = f.lower()
    if 'readme' in f_lower: groups['docs type']['README'].append(f)
    elif 'architecture' in f_lower: groups['docs type']['architecture'].append(f)
    elif 'standard' in f_lower: groups['docs type']['standard'].append(f)
    elif 'runbook' in f_lower: groups['docs type']['runbook'].append(f)
    elif 'audit' in f_lower: groups['docs type']['audit'].append(f)
    elif 'roadmap' in f_lower or 'plan' in f_lower: groups['docs type']['roadmap'].append(f)
    elif 'billing' in f_lower: groups['docs type']['billing'].append(f)
    elif 'deployment' in f_lower or 'deploy' in f_lower: groups['docs type']['deployment'].append(f)
    elif 'test' in f_lower: groups['docs type']['testing'].append(f)
    else: groups['docs type']['other'].append(f)

# 2. Missing docs
# Check products
for p in products:
    folder = product_folders.get(p, f"products/{p}")
    if not any(f.startswith(folder) for f in md_files):
        # The whole product folder might be missing, or just missing README
        if not os.path.exists(folder):
            add_issue(missing, 'medium', p, [folder], f'Product folder {folder} is missing completely.', 'Create product folder and initial README.')
        else:
            if not os.path.exists(os.path.join(folder, 'README.md')):
                add_issue(missing, 'high', p, [f'{folder}/README.md'], f'Missing README for product {p}', f'Create {folder}/README.md')
    else:
        if not os.path.exists(os.path.join(folder, 'README.md')):
            add_issue(missing, 'high', p, [f'{folder}/README.md'], f'Missing README for product {p}', f'Create {folder}/README.md')

# Look at shared packages
for d in os.listdir('packages') if os.path.exists('packages') else []:
    if os.path.isdir(os.path.join('packages', d)):
        if not os.path.exists(os.path.join('packages', d, 'README.md')):
            add_issue(missing, 'medium', 'shared package', [f'packages/{d}/README.md'], f'Missing README for package {d}', 'Create README.md')

for d in os.listdir('monorepo-packages') if os.path.exists('monorepo-packages') else []:
    if os.path.isdir(os.path.join('monorepo-packages', d)):
        if not os.path.exists(os.path.join('monorepo-packages', d, 'README.md')):
            add_issue(missing, 'medium', 'shared package', [f'monorepo-packages/{d}/README.md'], f'Missing README for monorepo package {d}', 'Create README.md')

# Look at standards
if not any('index.md' in f.lower() or 'readme.md' in f.lower() for f in md_files if f.startswith('docs/standards/')):
    add_issue(missing, 'medium', 'umbrella', ['docs/standards/README.md'], 'Standards folder exists but missing an index or README.', 'Create an index for standards.')

# Look at missing major topics canonical docs
for topic in major_topics:
    found = any(topic.replace(' ', '') in f.lower() or topic.split(' ')[0] in f.lower() for f in md_files)
    if not found:
        add_issue(missing, 'medium', 'umbrella', [f'docs/{topic.replace(" ", "_")}.md'], f'Missing canonical doc for major topic: {topic}', f'Create canonical doc for {topic}')

# 3. Duplicate Docs
filenames = {}
for f in md_files:
    name = os.path.basename(f).lower()
    if name not in filenames:
        filenames[name] = []
    filenames[name].append(f)

for name, paths in filenames.items():
    if len(paths) > 1 and name not in ['readme.md']:
        add_issue(duplicates, 'medium', 'various', paths, f'Duplicate filename {name} found in multiple locations.', 'Consolidate or rename to clarify distinct purposes.')

if 'archive/web-legacy/README.md' in md_files and 'web/README.md' in md_files:
    add_issue(duplicates, 'low', 'umbrella', ['archive/web-legacy/README.md', 'web/README.md'], 'Legacy web README exists alongside current web README.', 'Ensure legacy is clearly marked or remove if entirely superseded.')

if 'PROJECT_PLAN.md' in md_files and 'docs/PROJECT_PLAN.md' in md_files:
    add_issue(duplicates, 'high', 'umbrella', ['PROJECT_PLAN.md', 'docs/PROJECT_PLAN.md'], 'Duplicate PROJECT_PLAN.md found at root and in docs/.', 'Consolidate into a single canonical PROJECT_PLAN.md.')

# 4. Contradictions / Drift
for f in md_files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            # Bookiji excluded from Spine billing
            if 'bookiji' in content.lower() and 'billing' in content.lower() and 'spine' in content.lower():
                add_issue(drift, 'critical', 'umbrella', [f], 'Bookiji must remain excluded from Spine billing docs, but mentioned together.', 'Review and clarify Bookiji billing isolation.')

            # Product counts
            count_matches = re.findall(r'(\d+)\s+products', content.lower())
            for match in count_matches:
                if int(match) != 4:
                    add_issue(drift, 'high', 'umbrella', [f], f'Mentions {match} products, but current product count is 4.', 'Update product count to 4.')

            if 'kinetix' not in content.lower() and 'bookiji' in content.lower() and 'myassist' in content.lower():
                 # just a heuristic
                 pass

    except Exception:
        pass

# 5. Broken References
link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
for f in md_files:
    dir_path = os.path.dirname(f)
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            links = link_pattern.findall(content)
            for text, link in links:
                if link.startswith('http') or link.startswith('#') or link.startswith('mailto:'):
                    continue
                # strip anchor
                link_path = link.split('#')[0]
                if not link_path: continue

                target_path = os.path.normpath(os.path.join(dir_path, link_path))
                if not os.path.exists(target_path):
                    add_issue(broken_refs, 'high', 'umbrella', [f], f'Broken internal link to {link}', f'Fix or remove link to {link}')
    except Exception:
        pass


# 6. Canonical Ownership Issues
# Check if major topics have clear ownership
topic_owners = {
    'billing': [f for f in md_files if 'billing' in f.lower()],
    'architecture': [f for f in md_files if 'architecture' in f.lower() and 'audit' not in f.lower()],
    'deployment': [f for f in md_files if 'deployment' in f.lower() or 'deploy' in f.lower()],
}

for topic, files in topic_owners.items():
    if len(files) > 1 and not any(f.endswith(f'{topic}.md') for f in files):
         add_issue(canonical_issues, 'high', 'umbrella', files, f'Multiple files cover {topic} without a clear canonical index or owner.', f'Create a canonical {topic}.md index or consolidate.')

# Build Output Report
report = """# Bookiji Inc Documentation Integrity Report

## Executive summary
This report outlines the integrity of documentation across the Bookiji Inc umbrella repository. It checks for missing docs, duplicates, drift, broken references, and canonical ownership.

"""

# determine health
health = "healthy"
if len(missing) > 5 or len(duplicates) > 5 or len(drift) > 2 or len(broken_refs) > 10:
    health = "acceptable with cleanup needed"
if len(drift) > 5 or len(canonical_issues) > 3:
    health = "drifting"
if len(missing) > 15 or len(duplicates) > 10:
    health = "structurally inconsistent"


report += f"**Current Status:** {health}\n\n"

report += "## Inventory summary\n"
report += f"- Total markdown files: {len(md_files)}\n"
report += "- By Group:\n"
report += f"  - Root: {len(groups['root'])}\n"
report += f"  - Shared Package: {len(groups['shared package'])}\n"
for p, files in groups['product'].items():
    report += f"  - Product ({p}): {len(files)}\n"

report += "- By Type:\n"
for t, files in groups['docs type'].items():
    report += f"  - {t.capitalize()}: {len(files)}\n"

def print_issues(issues):
    res = ""
    for issue in issues:
        res += f"- **Severity:** {issue['severity'].upper()}\n"
        res += f"  - **Scope:** {issue['scope']}\n"
        res += f"  - **Paths:** {', '.join(issue['paths'])}\n"
        res += f"  - **Explanation:** {issue['explanation']}\n"
        res += f"  - **Recommended Action:** {issue['action']}\n\n"
    if not issues:
        res += "- No issues found.\n\n"
    return res

report += "\n## Missing documentation\n"
report += print_issues(missing)

report += "## Duplicate / overlapping documentation\n"
report += print_issues(duplicates)

report += "## Contradictions / drift\n"
report += print_issues(drift)

report += "## Broken references\n"
report += print_issues(broken_refs)

report += "## Canonical ownership issues\n"
report += print_issues(canonical_issues)

# Gather top 10 actions
all_issues = missing + duplicates + drift + broken_refs + canonical_issues
# sort by severity: critical -> high -> medium -> low
severity_val = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
all_issues.sort(key=lambda x: severity_val.get(x['severity'], 4))

report += "## Recommended cleanup actions (Top 10)\n"
for i, issue in enumerate(all_issues[:10]):
    report += f"{i+1}. [{issue['severity'].upper()}] {issue['explanation']} -> {issue['action']} (Paths: {', '.join(issue['paths'])})\n"

report += "\n## Safe auto-fix candidates\n"
auto_fix = [i for i in all_issues if i['severity'] == 'high' and 'link' in i['explanation'].lower()]
if auto_fix:
    for i, issue in enumerate(auto_fix):
        report += f"- Fix broken links in: {', '.join(issue['paths'])}\n"
else:
    report += "- None identified.\n"

report += "\n## Needs human decision\n"
human_decisions = [i for i in all_issues if i['severity'] in ['critical', 'high'] and 'link' not in i['explanation'].lower()]
if human_decisions:
    for i, issue in enumerate(human_decisions):
        report += f"- {issue['explanation']} (Paths: {', '.join(issue['paths'])})\n"
else:
    report += "- None identified.\n"


with open('integrity_report.md', 'w') as f:
    f.write(report)

print("Report generated: integrity_report.md")
