/**
 * GAS Template, Background Tasks
 *
 * Register/unregister background fetch tasks.
 *
 * Requires optional dependencies:
 *   expo-task-manager, expo-background-fetch
 *
 * If not installed, these functions are safe no-ops.
 */

import { addBreadcrumb } from './sentry';

// Try to require optional deps at module level
let TaskManager: any = null;
let BackgroundFetch: any = null;
try { TaskManager = require('expo-task-manager'); } catch { /* not installed */ }
try { BackgroundFetch = require('expo-background-fetch'); } catch { /* not installed */ }

/** Register a background fetch task. No-op if deps not installed. */
export async function registerBackgroundFetch(
  taskName: string,
  handler: () => Promise<void>,
  intervalMinutes = 15,
): Promise<void> {
  if (!TaskManager || !BackgroundFetch) return;

  try {
    TaskManager.defineTask(taskName, async () => {
      try {
        await handler();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    await BackgroundFetch.registerTaskAsync(taskName, {
      minimumInterval: intervalMinutes * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    addBreadcrumb('background', `Registered task: ${taskName}`);
  } catch {
    addBreadcrumb('background', `Failed to register: ${taskName}`);
  }
}

/** Unregister a background fetch task. No-op if deps not installed. */
export async function unregisterBackgroundFetch(taskName: string): Promise<void> {
  if (!BackgroundFetch) return;

  try {
    await BackgroundFetch.unregisterTaskAsync(taskName);
    addBreadcrumb('background', `Unregistered task: ${taskName}`);
  } catch {
    addBreadcrumb('background', `Failed to unregister: ${taskName}`);
  }
}
