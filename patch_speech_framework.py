import re
import uuid

PROJECT_PATH = 'watchos/KinetixWatch.xcodeproj/project.pbxproj'

def generate_id():
    return uuid.uuid4().hex[:24].upper()

def patch_frameworks():
    with open(PROJECT_PATH, 'r') as f:
        content = f.read()
        
    if 'Speech.framework' in content:
        print("Speech.framework already in project file.")
        return

    file_uuid = generate_id()
    build_uuid = generate_id()
    
    print(f"Generated Framework File UUID: {file_uuid}")
    print(f"Generated Framework Build UUID: {build_uuid}")

    # 1. Add to PBXBuildFile section
    # 5C108A55... is a reference ID, we need a new one
    build_file_entry = f'\t\t{build_uuid} /* Speech.framework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {file_uuid} /* Speech.framework */; }};\n'
    content = re.sub(r'(/\* Begin PBXBuildFile section \*/\n)', f'\\1{build_file_entry}', content)

    # 2. Add to PBXFileReference section
    file_ref_entry = f'\t\t{file_uuid} /* Speech.framework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = Speech.framework; path = System/Library/Frameworks/Speech.framework; sourceTree = SDKROOT; }};\n'
    content = re.sub(r'(/\* Begin PBXFileReference section \*/\n)', f'\\1{file_ref_entry}', content)

    # 3. Add to KinetixWatch Group (or a Frameworks group if it exists, but main group is fine)
    group_regex = r'(263B52B5E2DDCC4D94A1584B /\* KinetixWatch \*/ = \{[\s\S]*?children = \()(\n)'
    content = re.sub(group_regex, f'\\1\n\t\t\t\t{file_uuid} /* Speech.framework */,', content)

    # 4. Add to Frameworks Build Phase
    # We need to find the PBXFrameworksBuildPhase. If it doesn't exist, we must create it.
    # Existing phases: Sources (50BC36C0...), Resources (3624A978...)
    # Let's check if it exists.
    
    if 'isa = PBXFrameworksBuildPhase' in content:
        print("Found Frameworks Build Phase, adding Speech...")
        phase_regex = r'(isa = PBXFrameworksBuildPhase;[\s\S]*?files = \()(\n)'
        content = re.sub(phase_regex, f'\\1\n\t\t\t\t{build_uuid} /* Speech.framework in Frameworks */,', content)
    else:
        print("Creating new Frameworks Build Phase...")
        phase_uuid = generate_id()
        
        # Create the phase object
        phase_obj = f'''\t\t{phase_uuid} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{build_uuid} /* Speech.framework in Frameworks */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};\n'''
        content = re.sub(r'(/\* Begin PBXFrameworksBuildPhase section \*/\n)', f'\\1{phase_obj}', content)
        if '/* Begin PBXFrameworksBuildPhase section */' not in content:
             # If section doesn't exist, add it after Resources section
             content = re.sub(r'(/\* End PBXResourcesBuildPhase section \*/)', f'\\1\n\n/* Begin PBXFrameworksBuildPhase section */\n{phase_obj}/* End PBXFrameworksBuildPhase section */', content)

        # Add phase to Native Target
        target_regex = r'(buildPhases = \()(\n)'
        content = re.sub(target_regex, f'\\1\n\t\t\t\t{phase_uuid} /* Frameworks */,', content)

    with open(PROJECT_PATH, 'w') as f:
        f.write(content)
    
    print("Project file patched with Speech.framework.")

if __name__ == '__main__':
    patch_frameworks()












