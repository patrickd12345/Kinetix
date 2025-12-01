# Testing & Verification

The app now includes built-in verification tools to ensure logic integrity without needing an external test runner.

## 1. Self-Test Suite ("Jest"-like)

Located in **Settings → System → Self-Test**.

This runs a series of internal checks on:
- **Form Metrics**: Verifies calculations for Efficiency, Step Length, and Leg Stiffness.
- **Adaptive Learner**: Checks that the learning engine is initialized with correct defaults and accepts data.
- **Form Coach**: Simulates "Bad Form" and "Good Form" scenarios to ensure the recommendation engine triggers correctly (Rule-Based).

### How to run:
1. Open the app on Simulator or Device.
2. Go to Settings (Page 2).
3. Scroll down to System.
4. Tap "Self-Test".
5. Tap "Run Tests".
6. Watch for ✅ PASS logs.

## 2. UI Audit

Located in **Settings → System → UI Audit**.

Checks the current screen for:
- Accessibility labels
- Color contrast
- Touch target sizes
- Typography compliance

## 3. Compilation & Integrity

The project now compiles cleanly (`BUILD SUCCEEDED`) with zero critical warnings.
- Fixed `LocationManager` duplicate methods.
- Fixed `RunView` complex expression errors by refactoring alerts into extensions.
- Fixed missing file references in Xcode project.



