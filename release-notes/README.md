# Release Notes

Every release ships a `release-notes/v{semver}.md` file. `eas submit` reads these as the App Store and Play Store "what's new" text.

## Format

Markdown file per version. The first H2 is the default English copy. Optional H2 sections per locale code (`## de`, `## fr`, etc.) override for that locale during submission.

Keep entries short and user-facing. Internal refactors don't belong here — that's CHANGELOG.md.

## Pipeline

`scripts/check-release-notes.mjs` runs in CI before `eas submit` and fails when `release-notes/v$EXPO_PUBLIC_APP_VERSION.md` is missing.
