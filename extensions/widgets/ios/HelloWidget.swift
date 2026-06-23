// HelloWidget.swift
// GAS Template — iOS WidgetKit scaffold
//
// Replace {{bundleIdentifier}} with your app bundle ID at build time.
// Example App Group: group.com.example.myapp
//
// Widget reads the `nextTask` key from the shared UserDefaults suite.
// Timeline refreshes every 15 minutes.

import WidgetKit
import SwiftUI

// ─── App Group ───────────────────────────────────────────────────────────────

private let appGroupID = "group.{{bundleIdentifier}}"
private let nextTaskKey = "nextTask"

// ─── Model ───────────────────────────────────────────────────────────────────

struct HelloEntry: TimelineEntry {
    let date: Date
    let nextTask: String?
}

// ─── Provider ────────────────────────────────────────────────────────────────

struct HelloProvider: TimelineProvider {
    func placeholder(in context: Context) -> HelloEntry {
        HelloEntry(date: Date(), nextTask: "Buy groceries")
    }

    func getSnapshot(in context: Context, completion: @escaping (HelloEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HelloEntry>) -> Void) {
        let entry = makeEntry()
        // Refresh every 15 minutes
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }

    private func makeEntry() -> HelloEntry {
        let defaults = UserDefaults(suiteName: appGroupID)
        let value = defaults?.string(forKey: nextTaskKey)
        return HelloEntry(date: Date(), nextTask: value)
    }
}

// ─── Views ───────────────────────────────────────────────────────────────────

struct HelloWidgetEntryView: View {
    var entry: HelloProvider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Next Task")
                .font(.caption)
                .foregroundColor(.secondary)
            Text(entry.nextTask ?? "Set up your first task")
                .font(.headline)
                .lineLimit(2)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// ─── Widget ──────────────────────────────────────────────────────────────────

@main
struct HelloWidget: Widget {
    let kind: String = "HelloWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HelloProvider()) { entry in
            HelloWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Next Task")
        .description("Shows your next task at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// ─── Preview ─────────────────────────────────────────────────────────────────

#Preview(as: .systemSmall) {
    HelloWidget()
} timeline: {
    HelloEntry(date: .now, nextTask: "Buy groceries")
    HelloEntry(date: .now, nextTask: nil)
}
