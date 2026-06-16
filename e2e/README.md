# E2E Testing with Maestro

GAS Template recommends [Maestro](https://maestro.mobile.dev/) for E2E testing on Expo/React Native.

## Why Maestro over Detox

- Zero native build configuration (works with Expo Go and dev builds)
- YAML-based flows — no JavaScript test code needed
- Built-in waiting and retry logic
- Works on both iOS simulators and Android emulators

## Setup

```bash
# Install Maestro CLI (macOS/Linux)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
maestro --version
```

## Running Tests

```bash
# Start the dev server
pnpm exec expo start

# Run all flows
maestro test e2e/flows/

# Run a specific flow
maestro test e2e/flows/auth-signup.yaml
```

## Sample Flow: Auth Signup → Onboarding → Dashboard

Create `e2e/flows/auth-signup.yaml`:

```yaml
appId: com.yourapp.example  # Replace with your bundle ID
---
# Navigate to signup
- tapOn: "Create Account"

# Fill signup form
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Password"
- inputText: "SecurePass123!"
- tapOn: "Sign Up"

# Onboarding flow
- assertVisible: "Welcome"
- tapOn: "Next"
- tapOn: "Next"
- tapOn: "Get Started"

# Verify dashboard loaded
- assertVisible: "Settings"
```

## Sample Flow: Tab Navigation

Create `e2e/flows/tab-navigation.yaml`:

```yaml
appId: com.yourapp.example
---
# Verify all tabs are accessible
- tapOn:
    id: "tab-0"
- assertVisible: ".*"  # First tab content

- tapOn:
    id: "tab-1"
- assertVisible: ".*"  # Second tab content

# Navigate to settings
- tapOn: "Settings"
- assertVisible: "Settings"
- assertVisible: "Sign Out"
```

## Sample Flow: Settings

Create `e2e/flows/settings.yaml`:

```yaml
appId: com.yourapp.example
---
- tapOn: "Settings"

# Theme toggle (if dark mode enabled)
- tapOn: "Light"
- tapOn: "Dark"

# Sign out flow
- tapOn: "Sign Out"
- assertVisible: "Are you sure"
- tapOn: "Cancel"
```

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
e2e:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - uses: mobile-dev-inc/action-maestro-cloud@v1
      with:
        api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
        app-file: path/to/your.app
        flows: e2e/flows/
```

## Notes

- Actual E2E flows are app-specific — the DevAgent should generate flows matching the app's screens
- Use `maestro studio` for interactive flow recording
- Maestro Cloud provides CI-compatible test execution with video recording
