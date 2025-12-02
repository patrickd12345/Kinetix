import re
import uuid

PROJECT_PATH = 'watchos/KinetixWatch.xcodeproj/project.pbxproj'

def generate_id():
    return uuid.uuid4().hex[:24].upper()

def patch_project():
    with open(PROJECT_PATH, 'r') as f:
        content = f.read()
        
    if 'VoiceCoach.swift' in content:
        print("VoiceCoach.swift already in project file.")
        return

    file_uuid = generate_id()
    build_uuid = generate_id()
    
    print(f"Generated File UUID: {file_uuid}")
    print(f"Generated Build UUID: {build_uuid}")

    # 1. Add to PBXBuildFile section
    build_file_entry = f'\t\t{build_uuid} /* VoiceCoach.swift in Sources */ = {{isa = PBXBuildFile; fileRef = {file_uuid} /* VoiceCoach.swift */; }};\n'
    content = re.sub(r'(/\* Begin PBXBuildFile section \*/\n)', f'\\1{build_file_entry}', content)

    # 2. Add to PBXFileReference section
    file_ref_entry = f'\t\t{file_uuid} /* VoiceCoach.swift */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VoiceCoach.swift; sourceTree = "<group>"; }};\n'
    content = re.sub(r'(/\* Begin PBXFileReference section \*/\n)', f'\\1{file_ref_entry}', content)

    # 3. Add to KinetixWatch Group
    # Group ID: 263B52B5E2DDCC4D94A1584B
    group_regex = r'(263B52B5E2DDCC4D94A1584B /\* KinetixWatch \*/ = \{[\s\S]*?children = \()(\n)'
    content = re.sub(group_regex, f'\\1\n\t\t\t\t{file_uuid} /* VoiceCoach.swift */,', content)

    # 4. Add to Sources Build Phase
    # Phase ID: 50BC36C0E65510CAAC2F0B66
    phase_regex = r'(50BC36C0E65510CAAC2F0B66 /\* Sources \*/ = \{[\s\S]*?files = \()(\n)'
    content = re.sub(phase_regex, f'\\1\n\t\t\t\t{build_uuid} /* VoiceCoach.swift in Sources */,', content)

    with open(PROJECT_PATH, 'w') as f:
        f.write(content)
    
    print("Project file patched successfully.")

if __name__ == '__main__':
    patch_project()





