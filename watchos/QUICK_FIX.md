# Quick Fix Reference

**Having watchOS installation issues? Start here!**

## 🚀 Quick Fix (90% of cases)

```bash
cd watchos
./fix-watch-install.sh
```

Then follow the on-screen instructions.

## 📋 Most Common Solution

**Install Watch app via iPhone first:**

1. Build iPhone app in Xcode (KinetixPhone scheme → ⌘+R)
2. On iPhone: Open Watch app → Find "Kinetix" → Tap "Install"
3. Wait 1-2 minutes for installation
4. Then build Watch app in Xcode (KinetixWatch scheme → ⌘+R)

**Why:** Apple requires Watch apps to be installed via iPhone first. Xcode can only deploy updates after initial installation.

## 📚 Full Documentation

For comprehensive solutions, see:
- **[WATCH_INSTALL_FIX.md](./WATCH_INSTALL_FIX.md)** - Complete fix guide with all methods
- **[WATCH_CONNECTION_TROUBLESHOOTING.md](./WATCH_CONNECTION_TROUBLESHOOTING.md)** - Connection issues
- **[SPECIFIC_FIXES.md](./SPECIFIC_FIXES.md)** - Specific error solutions

## 🔧 Scripts

- `./fix-watch-install.sh` - Automated fix script
- `./fix-watch-install.sh --clean` - Clean caches only
- `./fix-watch-install.sh --check` - Check configuration
- `./verify-watch-setup.sh` - Verify setup

## ✅ Verification

Run verification to check your setup:
```bash
./verify-watch-setup.sh
```

## 🆘 Still Not Working?

1. Check [WATCH_INSTALL_FIX.md](./WATCH_INSTALL_FIX.md) for all methods
2. Run `./fix-watch-install.sh --verify` for checklist
3. Check Xcode console for specific errors (View → Debug Area)

---

**Remember:** Watch apps must be installed via iPhone first. This is by design.






