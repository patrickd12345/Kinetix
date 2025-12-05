import re

PROJECT_PATH = 'watchos/KinetixWatch.xcodeproj/project.pbxproj'

def unpatch_project():
    with open(PROJECT_PATH, 'r') as f:
        content = f.read()
        
    # Remove Build File
    content = re.sub(r'\t\t[A-F0-9]{24} /\* Speech.framework in Frameworks \*/ = \{isa = PBXBuildFile; fileRef = [A-F0-9]{24} /\* Speech.framework \*/; \};\n', '', content)

    # Remove File Reference
    content = re.sub(r'\t\t[A-F0-9]{24} /\* Speech.framework \*/ = \{isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = Speech.framework; path = System/Library/Frameworks/Speech.framework; sourceTree = SDKROOT; \};\n', '', content)

    # Remove from Group
    content = re.sub(r'\t\t\t\t[A-F0-9]{24} /\* Speech.framework \*/,\n', '', content)

    # Remove from Frameworks Build Phase
    content = re.sub(r'\t\t\t\t[A-F0-9]{24} /\* Speech.framework in Frameworks \*/,\n', '', content)
    
    # Remove the Frameworks Build Phase itself if empty? No, let's leave it for now to avoid breaking structure if I'm not careful.
    # But wait, I added the phase manually if it didn't exist. 
    # If I remove the file from the phase, the phase becomes empty.
    
    with open(PROJECT_PATH, 'w') as f:
        f.write(content)
    
    print("Speech.framework removed from project file.")

if __name__ == '__main__':
    unpatch_project()












