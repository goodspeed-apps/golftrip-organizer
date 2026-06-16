# Widget Extension Runbook

Home-screen widgets surface app data without requiring the user to open the app. This template ships a hello-world "Next Task" widget for both iOS and Android. The native code lives under `extensions/widgets/`. The JS-side API lives in `services/widget-data.ts`.

---

## Why widgets

- Users see up-to-date task or status information directly on the home screen.
- Tapping the widget deep-links into the relevant screen.
- The shared-data layer (App Groups on iOS, ContentProvider on Android) means the widget reads data written by the main app with zero network calls.

---

## iOS setup

### 1. App Group entitlement

Add the App Group capability to both the **main app target** and the **widget extension target** in Xcode. The group ID must match the token in the template files: `group.{{bundleIdentifier}}`.

In `app.config.js`, add the entitlement to the `ios` section:

ios: {
  bundleIdentifier: 'com.example.myapp',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.example.myapp'],
  },
}

Replace `com.example.myapp` with your actual bundle identifier everywhere.

### 2. Provisioning profile

The provisioning profile for both targets must include the **App Groups** capability. Regenerate profiles in the Apple Developer portal after adding the capability or use EAS credentials management (`eas credentials`) to handle it automatically.

### 3. Widget extension target

EAS Build can auto-generate the widget extension target when `app.config.js` declares it via the `expo-build-properties` or a custom Expo config plugin. Alternatively, add the target manually in Xcode:

- File > New > Target > Widget Extension
- Name it `HelloWidget` (matches `HelloWidget.swift`)
- Copy `extensions/widgets/ios/HelloWidget.swift` into the target
- Copy `extensions/widgets/ios/HelloWidget.entitlements` and set it as the entitlements file for the widget target
- Add the Expo Modules native iOS module (`extensions/widgets/expo-modules/WidgetDataModule.swift`) to **both** the main app target and the widget extension target

### 4. Replace template tokens

Search for `{{bundleIdentifier}}` in all files under `extensions/widgets/ios/` and `extensions/widgets/expo-modules/` and replace with your bundle identifier.

---

## Android setup

### 1. Manifest merges

The template ships `extensions/widgets/android/AndroidManifest.xml` as a fragment. Merge it into your app's main `AndroidManifest.xml` via an Expo config plugin or by hand:

- Copy the `<receiver>` block into `<application>`.
- Copy the `<provider>` block into `<application>`.
- Replace `{{bundleIdentifier}}` with your app package name.

The `android:authorities` value for the ContentProvider **must** match `{{bundleIdentifier}}.widgetdata` - this is the URI the widget uses to query data.

### 2. Widget metadata

Copy `extensions/widgets/android/hello_widget_info.xml` to `android/app/src/main/res/xml/hello_widget_info.xml` in your project.

Copy the Kotlin files:

- `extensions/widgets/android/HelloWidgetProvider.kt` → your widget package
- `extensions/widgets/expo-modules/WidgetDataModule.kt` → your module package

Replace `{{bundleIdentifier}}` with your package name in all Kotlin files.

### 3. Layout file

Create `android/app/src/main/res/layout/hello_widget.xml` with a `RemoteViews`-compatible layout containing a `TextView` with `android:id="@+id/widget_next_task"`. The provider sets the text on that view.

### 4. Replace template tokens

Search for `{{bundleIdentifier}}` in all files under `extensions/widgets/android/` and `extensions/widgets/expo-modules/` and replace with your package name.

---

## JS-side usage

Import from `services/widget-data`:

import { setWidgetData, getWidgetData } from '@/services/widget-data';

The API accepts any serializable value - string, number, boolean, plain object, or array. A JS-side codec serializes values into a typed envelope before writing to the native string bridge, so they round-trip without loss of type information.

// String
await setWidgetData('nextTask', 'Buy groceries');

// Number
await setWidgetData('streakDays', 7);

// Boolean
await setWidgetData('isPremium', true);

// Object
await setWidgetData('todo', { id: 1, label: 'Buy milk' });

// Read back with a type parameter
const task = await getWidgetData<string>('nextTask');
const streak = await getWidgetData<number>('streakDays') ?? 0;

Both functions are safe to call unconditionally:

- On **web** they are no-ops (return `undefined` / `null` immediately).
- In **Expo Go** (native module not linked) they no-op and log a `console.warn`.
- On a **production build** with the module linked they write/read through the native layer and trigger a widget refresh.

The generic type parameter on `getWidgetData<T>` is a type assertion - the runtime value is what was written. If you need strict validation, assert the shape yourself after reading.

**Legacy raw strings:** app versions that wrote raw strings before this codec was introduced are still readable. The reader auto-detects whether a stored value is an envelope or a plain legacy string and returns the raw string in the latter case.

---

## Size limits

The native bridge stores each key in platform string storage (UserDefaults on iOS, SharedPreferences on Android). Large values degrade widget refresh performance.

- **32 KB warning:** writing a value whose encoded size exceeds 32 KB logs a Sentry warning with the key name and size. The write still proceeds.
- **64 KB hard reject:** writing a value whose encoded size exceeds 64 KB throws a `ServiceError` with code `widget_data_too_large` and HTTP status 413. The write is rejected and the native bridge is never called.

Keep widget data small - a few string or numeric fields per key is the intended usage pattern.

---

## Extending the hello-world widget

### Add a new data key

1. In your app code, call `setWidgetData('myKey', value)` wherever the data changes.
2. On iOS, update `HelloWidget.swift`:
   - Read the new key from `UserDefaults` in `makeEntry()`.
   - Add a field to `HelloEntry`.
   - Render the field in `HelloWidgetEntryView`.
3. On Android, update `HelloWidgetProvider.kt`:
   - Query the new key from the ContentProvider URI `content://{authority}/widget_data/myKey`.
   - Bind the value to a new `TextView` in `hello_widget.xml` via `RemoteViews`.

### Change the refresh interval

- **iOS:** Edit the `byAdding: .minute, value: 15` line in `HelloProvider.getTimeline`. Minimum recommended is 15 minutes; shorter intervals drain battery.
- **Android:** Edit `android:updatePeriodMillis` in `hello_widget_info.xml`. Android enforces a minimum of 1 800 000 ms (30 minutes) for battery reasons; use `ACTION_APPWIDGET_UPDATE` broadcasts for faster updates if needed.

### Add a tap action

- **iOS:** Wrap `HelloWidgetEntryView` in a `Link` pointing to your app URL scheme: `Link(destination: URL(string: "myapp://tasks")!) { ... }`.
- **Android:** Set a `PendingIntent` on the `RemoteViews` in `HelloWidgetProvider.updateWidget`.

---

## Build commands

Widgets require a full native build. OTA updates do not update widget code.

# Build for both platforms with widget extension included
eas build --profile production

# iOS only
eas build --platform ios --profile production

# Android only
eas build --platform android --profile production

Before building, confirm:

- App Group entitlement is in `app.config.js` (iOS).
- Widget extension target is configured in Xcode or via an EAS plugin (iOS).
- Manifest fragment is merged (Android).
- All `{{bundleIdentifier}}` tokens are replaced.

---

## Troubleshooting

- **Widget shows stale data (iOS):** Call `setWidgetData` after every state change. The native module calls `WidgetCenter.shared.reloadAllTimelines()` automatically on each write.
- **Widget shows stale data (Android):** Confirm the ContentProvider authority matches `{packageName}.widgetdata`. Check Logcat for provider query errors.
- **Module not available warning in Expo Go:** Expected. Widgets require a custom dev build (`eas build --profile development`) or a production build.
- **App Group not working (iOS):** Confirm both targets (main app and widget extension) share the same App Group ID and that the provisioning profiles include the capability.