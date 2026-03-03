# XcodeBuilder extension (when it doesn't show in the list)

The **XcodeBuilder** extension (`ahmet.xcode-builder`) may not appear in Cursor's extension search. Install it manually:

## Option A: Install from VSIX (works in Cursor and VS Code)

1. Download the extension package:
   - Open: https://marketplace.visualstudio.com/items?itemName=ahmet.xcode-builder
   - On the right, open **Version History**
   - Click the **Download** link for the latest version (e.g. "ahmet.xcode-builder-0.x.x.vsix")

2. In Cursor or VS Code:
   - Open the **Extensions** view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Click the **...** menu at the top of the Extensions panel
   - Choose **Install from VSIX...**
   - Select the downloaded `.vsix` file

## Option B: VS Code on Mac only

If you use **VS Code** (not Cursor) on a Mac, run in Terminal:

```bash
code --install-extension ahmet.xcode-builder
```

## Requirements

- **macOS** with **Xcode 15+**
- For physical device: `brew install ios-deploy`
