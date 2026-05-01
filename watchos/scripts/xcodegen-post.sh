#!/usr/bin/env bash
# XcodeGen cannot express platformFilters = (iphoneos) for Watch embeds (only "ios", which still embeds on Simulator).
# Run after `xcodegen generate` via options.postGenCommand in project.yml.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBX="${ROOT}/KinetixWatch.xcodeproj/project.pbxproj"
exec python3 - "$PBX" << 'PY'
import pathlib
import re
import sys

pbx = pathlib.Path(sys.argv[1])
text = pbx.read_text(encoding="utf-8")
orig = text

# Embed Watch Content: device-only filter (skip embedding watchOS bundle in iOS Simulator host).
text, n = re.subn(
    r"(/\* KinetixWatch\.app in Embed Watch Content \*/ = \{isa = PBXBuildFile; "
    r"fileRef = [^;]+; )(?!platformFilters = \(iphoneos\); )"
    r"(settings = \{ATTRIBUTES = \(RemoveHeadersOnCopy, \); \}; \};)",
    r"\1platformFilters = (iphoneos); \2",
    text,
    count=1,
)
if n != 1:
    print("xcodegen-post: warning: Embed Watch PBXBuildFile pattern did not match exactly once", file=sys.stderr)

# KinetixPhone -> KinetixWatch target dependency (proxy id is stable in generated project).
dep_block = re.compile(
    r"(\t\t[a-f0-9A-F]{24} /\* PBXTargetDependency \*/ = \{\n"
    r"\t\t\tisa = PBXTargetDependency;\n)"
    r"(?!\t\t\tplatformFilters)"
    r"(\t\t\ttarget = [^\n]+ /\* KinetixWatch \*/;\n"
    r"\t\t\ttargetProxy = 071D41A2DA8C0EF5C94F745B /\* PBXContainerItemProxy \*/;\n"
    r"\t\t\};)",
    re.MULTILINE,
)

def add_dep_platform(m: re.Match) -> str:
    return (
        m.group(1)
        + "\t\t\tplatformFilters = (\n\t\t\t\tiphoneos,\n\t\t\t);\n"
        + m.group(2)
    )

text, n_dep = dep_block.subn(add_dep_platform, text, count=1)
if n_dep != 1:
    print("xcodegen-post: warning: KinetixPhone PBXTargetDependency pattern did not match exactly once", file=sys.stderr)

if text != orig:
    pbx.write_text(text, encoding="utf-8")
    print("xcodegen-post: updated project.pbxproj (iphoneos filters for Watch embed)")
else:
    print("xcodegen-post: project.pbxproj unchanged")
PY
