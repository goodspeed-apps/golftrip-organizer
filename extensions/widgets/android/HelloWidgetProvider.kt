// HelloWidgetProvider.kt
// GAS Template — Android AppWidgetProvider scaffold
//
// Replace {{bundleIdentifier}} with your app package name at build time.
// The ContentProvider authority must match {{bundleIdentifier}}.widgetdata
//
// This provider reads the `nextTask` key from the shared ContentProvider
// exposed by the main app, then renders it into a 2x1 RemoteViews layout.
// Android refreshes the widget every 15 minutes via appwidget-provider.xml.

package {{bundleIdentifier}}.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class HelloWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val nextTask = readNextTask(context)
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId, nextTask)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, HelloWidgetProvider::class.java)
            )
            onUpdate(context, manager, ids)
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun readNextTask(context: Context): String? {
        val authority = "${context.packageName}.widgetdata"
        val uri = Uri.parse("content://$authority/widget_data/nextTask")
        return try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun updateWidget(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        nextTask: String?
    ) {
        val views = RemoteViews(context.packageName, R.layout.hello_widget)
        val label = nextTask?.takeIf { it.isNotBlank() } ?: "Set up your first task"
        views.setTextViewText(R.id.widget_next_task, label)
        manager.updateAppWidget(widgetId, views)
    }
}
