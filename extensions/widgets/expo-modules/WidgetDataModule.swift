// WidgetDataModule.swift
// GAS Template — Expo Modules iOS widget-data bridge
//
// Exposes `setItem` and `getItem` to JS via the Expo Modules API.
// Shared data lives in the App Group UserDefaults suite so the widget
// extension can read it without any IPC round-trip.
//
// After each write, `WidgetCenter.shared.reloadAllTimelines()` tells
// WidgetKit to fetch a new timeline immediately.
//
// Replace {{bundleIdentifier}} with your app bundle ID at build time.
// Example App Group: group.com.example.myapp

import ExpoModulesCore
import WidgetKit

public class WidgetDataModule: Module {

    // Expo Modules definition — declares the module name and JS-callable functions.
    public func definition() -> ModuleDefinition {
        Name("WidgetDataModule")

        // setItem(key, value) → writes to App Group UserDefaults, then reloads
        // widget timelines so the widget reflects the new value immediately.
AsyncFunction("setItem") { (key: String, value: String) in
            let defaults = self.sharedDefaults()
            defaults?.set(value, forKey: key)

            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }

        // getItem(key) → reads from App Group UserDefaults.
        // Returns nil (JS null) when the key has not been set yet.
        AsyncFunction("getItem") { (key: String) -> String? in
            return self.sharedDefaults()?.string(forKey: key)
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private func sharedDefaults() -> UserDefaults? {
        // App Group suite name is derived from bundleIdentifier at build time.
        // Operator must add the App Group capability + entitlement to the widget
        // extension target and the main app target before this works.
        let appGroupID = "group.{{bundleIdentifier}}"
        return UserDefaults(suiteName: appGroupID)
    }
}
