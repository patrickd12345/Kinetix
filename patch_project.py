import re
import uuid

PROJECT_PATH = 'watchos/KinetixWatch.xcodeproj/project.pbxproj'

def generate_id():
    return uuid.uuid4().hex[:24].upper()

def patch_project():
    with open(PROJECT_PATH, 'r') as f:
        content = f.read()
        
    if 'Assets.xcassets' in content:
        print("Assets.xcassets already in project file.")
        return

    file_uuid = generate_id()
    build_uuid = generate_id()
    
    print(f"Generated File UUID: {file_uuid}")
    print(f"Generated Build UUID: {build_uuid}")

    # 1. Add to PBXBuildFile section
    build_file_entry = f'\t\t{build_uuid} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {file_uuid} /* Assets.xcassets */; }};\n'
    content = re.sub(r'(/\* Begin PBXBuildFile section \*/\n)', f'\\1{build_file_entry}', content)

    # 2. Add to PBXFileReference section
    file_ref_entry = f'\t\t{file_uuid} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; }};\n'
    content = re.sub(r'(/\* Begin PBXFileReference section \*/\n)', f'\\1{file_ref_entry}', content)

    # 3. Add to KinetixWatch Group
    # Group ID: 263B52B5E2DDCC4D94A1584B
    # Look for the group definition
    group_regex = r'(263B52B5E2DDCC4D94A1584B /\* KinetixWatch \*/ = \{[\s\S]*?children = \()(\n)'
    content = re.sub(group_regex, f'\\1\n\t\t\t\t{file_uuid} /* Assets.xcassets */,', content)

    # 4. Add to Resources Build Phase
    # Phase ID: 3624A97865B295C699FFBF15
    phase_regex = r'(3624A97865B295C699FFBF15 /\* Resources \*/ = \{[\s\S]*?files = \()(\n)'
    content = re.sub(phase_regex, f'\\1\n\t\t\t\t{build_uuid} /* Assets.xcassets in Resources */,', content)

    with open(PROJECT_PATH, 'w') as f:
        f.write(content)
    
    print("Project file patched successfully.")

if __name__ == '__main__':
    patch_project()








