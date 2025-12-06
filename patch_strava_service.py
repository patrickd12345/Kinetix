import re
import uuid

PROJECT_PATH = 'watchos/KinetixWatch.xcodeproj/project.pbxproj'
FILE_TO_ADD = 'StravaService.swift'
FILE_PATH_IN_PROJECT = 'ios/KinetixPhone/Services/StravaService.swift'
SOURCES_BUILD_PHASE_UUID = '061ABD2CDC67DF480ACD0254'
SERVICES_GROUP_UUID = 'B9BFCF350590D231664F3E33'

def generate_id():
    return uuid.uuid4().hex[:24].upper()

def patch_project():
    with open(PROJECT_PATH, 'r') as f:
        content = f.read()
        
    if FILE_TO_ADD in content:
        print(f"{FILE_TO_ADD} already in project file.")
        return

    file_ref_uuid = generate_id()
    build_file_uuid = generate_id()
    
    print(f"Generated File Reference UUID: {file_ref_uuid}")
    print(f"Generated Build File UUID: {build_file_uuid}")

    # 1. Add to PBXFileReference section
    file_ref_entry = f'        {file_ref_uuid} /* {FILE_TO_ADD} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {FILE_TO_ADD}; sourceTree = "<group>"; }};
'
    content = re.sub(r'(/\* End PBXFileReference section \*/)', f'{file_ref_entry}\1', content)

    # 2. Add to PBXBuildFile section
    build_file_entry = f'        {build_file_uuid} /* {FILE_TO_ADD} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_ref_uuid} /* {FILE_TO_ADD} */; }};
'
    content = re.sub(r'(/\* End PBXBuildFile section \*/)', f'{build_file_entry}\1', content)

    # 3. Add to PBXSourcesBuildPhase
    sources_phase_regex = re.compile(f'({SOURCES_BUILD_PHASE_UUID} /\* Sources \*/ = {{[\s\S]*?files = \()([\s\S]*?)(\);[\s\S]*?}};)')
    
    def add_to_sources_phase(match):
        files = match.group(2)
        new_file_entry = f'                {build_file_uuid} /* {FILE_TO_ADD} in Sources */,\n'
        return match.group(1) + files + new_file_entry + match.group(3)

    content, num_subs = sources_phase_regex.subn(lambda m: m.group(1) + m.group(2) + f'\n\t\t\t\t{build_file_uuid} /* {FILE_TO_ADD} in Sources */,', content)
    if num_subs == 0:
        print("Could not find PBXSourcesBuildPhase section.")
        return

    # 4. Add to Services PBXGroup
    services_group_regex = re.compile(f'({SERVICES_GROUP_UUID} /\* Services \*/ = {{[\s\S]*?children = \()([\s\S]*?)(\);[\s\S]*?}};)')
    
    content, num_subs = services_group_regex.subn(lambda m: m.group(1) + m.group(2) + f'\n\t\t\t\t{file_ref_uuid} /* {FILE_TO_ADD} */,', content)
    if num_subs == 0:
        print("Could not find Services group.")
        return


    with open(PROJECT_PATH, 'w') as f:
        f.write(content)
    
    print("Project file patched successfully with StravaService.swift.")

if __name__ == '__main__':
    patch_project()
