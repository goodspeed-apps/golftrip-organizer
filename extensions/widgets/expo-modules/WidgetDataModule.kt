// WidgetDataModule.kt
// GAS Template — Expo Modules Android widget-data bridge
//
// Exposes `setItem` and `getItem` to JS via the Expo Modules API.
// Shared data lives in a named SharedPreferences file so the
// ContentProvider (WidgetDataProvider) can read it without extra IPC.
//
// After each write, notifies all AppWidget instances of the update so
// the widget re-queries the ContentProvider and re-renders.

package {{bundleIdentifier}}.widgetdata

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetDataModule : Module() {

    companion object {
        // SharedPreferences file name — must match WidgetDataProvider.PREFS_NAME
        const val PREFS_NAME = "widget_data"
    }

    override fun definition() = ModuleDefinition {
        Name("WidgetDataModule")

        // setItem(key, value) → persists to SharedPreferences, then signals
        // all home-screen widgets to re-render via AppWidgetManager.
        AsyncFunction("setItem") { key: String, value: String ->
            val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
            prefs(context).edit().putString(key, value).apply()
            notifyWidgets(context)
        }

        // getItem(key) → reads from SharedPreferences.
        // Returns null when the key has not been set.
        AsyncFunction("getItem") { key: String ->
            val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
            prefs(context).getString(key, null)
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun notifyWidgets(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val componentName = ComponentName(context, "{{bundleIdentifier}}.widget.HelloWidgetProvider")
        val ids = manager.getAppWidgetIds(componentName)
        if (ids.isNotEmpty()) {
            manager.notifyAppWidgetViewDataChanged(ids, android.R.id.list)
        }
    }
}
