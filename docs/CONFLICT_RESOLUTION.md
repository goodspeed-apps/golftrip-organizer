# Conflict Resolution Policy

When local mutations and remote state diverge, the resolution strategy depends on the data type. This doc covers the template's defaults; per-app overrides go in the relevant feature's README.

## Last-write-wins (default)

Most fields use last-write-wins: the most recent `updated_at` wins. This is what `useBackgroundSync` does when no `onConflict` is provided.

Tradeoff: simple, predictable; can silently overwrite concurrent edits.

## Operational transformation (custom)

For collaborative documents, register an `onConflict` resolver:

useBackgroundSync({
  query: () => fetchDoc(id),
  mutate: (local) => saveDoc(id, local),
  onConflict: (local, remote) => mergeDoc(local, remote),
});

The resolver receives both states and returns the merged result. Common patterns:

- **Operational transformation:** reconcile ops by their original position with a transform algorithm.
- **CRDT (Yjs / Automerge):** if both sides emit operations rather than snapshots, merging is commutative — the resolver becomes trivial.
- **User-presented conflict:** show a UI when the diff is non-trivial; let the user pick.

## Stale-while-revalidate

`useBackgroundSync` returns the last-known good state while a sync is in flight. UI never blocks on a network round trip.

## Offline queue

When offline, mutations are queued in `lib/offline.queueMutation`. They flush when the device reconnects (NetInfo listener). The queue is FIFO; mutations on the same key are deduped to the latest by default.

## Audit trail

All write operations on tables with `audit_trigger` (cluster 2) log to `audit_log`. Use this for debugging "what happened in what order" disputes.