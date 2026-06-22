# Visual Regression Testing

The template uses [Chromatic](https://www.chromatic.com/) to catch design-system regressions on every pull request. Storybook stories under `components/_primitives/` get snapshotted and diffed against the baseline.

## Scope

Storybook stories live in `stories/` and currently cover the primitives:

- `stories/Button.stories.tsx`
- `stories/Card.stories.tsx`
- `stories/EmptyState.stories.tsx`
- ...and any other story file added under `stories/`

App screens and feature components are intentionally NOT in scope. Chromatic's free tier allows 5,000 snapshots per month, and screen-level coverage would burn through it quickly. Native (RN) visual regression via Loki is deferred to a future cluster.

## Setup

One-time per project:

1. Sign up at chromatic.com and create a new project linked to this repo.
2. Copy the project token from Chromatic's dashboard.
3. In GitHub repo settings, add a secret named `CHROMATIC_PROJECT_TOKEN` with the value.
4. Push a PR that changes a primitive's color or layout. The workflow runs automatically.

## What the workflow does

`.github/workflows/visual.yml` triggers on every PR that touches:

- `stories/**`
- `.storybook/**`
- `package.json`

The job builds Storybook with `npm run build-storybook`, uploads the output to Chromatic, and Chromatic compares snapshots against the baseline. The action uses `onlyChanged: true` to limit the snapshot count to stories actually affected by the PR.

## Approving baseline changes

When a primitive intentionally changes (new design token, layout adjustment, theme refresh):

1. Open the PR. The Chromatic check will fail with a link to the diff URL.
2. Click through to the Chromatic UI.
3. Review each diff. Approve the ones that are intentional.
4. The PR check will re-run and pass.

Unapproved baseline changes block the PR.

## Adding new primitives

When adding a new primitive component:

1. Add a `.stories.tsx` file in `stories/` (matches the existing `Button.stories.tsx` / `Card.stories.tsx` pattern; component itself lives in `components/`).
2. Cover the variants users will see: sizes, states (default / hover / disabled / error), color modes (light / dark).
3. Open the PR. Chromatic will snapshot the new stories and add them to the baseline on first approval.

## Snapshot budget

The free tier provides 5,000 snapshots per month. Each story variant counts as one snapshot per build. With ~10 primitives × ~5 variants × ~20 builds per month, the budget is comfortable. If the count climbs:

- Reduce variant coverage in stories that rarely change
- Trim the `paths` filter in `visual.yml` to skip docs-only PRs
- Upgrade the Chromatic plan
