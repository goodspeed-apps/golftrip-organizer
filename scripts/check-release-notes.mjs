#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const version = process.env.EXPO_PUBLIC_APP_VERSION
  ?? JSON.parse(readFileSync('package.json', 'utf8')).version;

if (!version) {
  console.error('Could not resolve app version (set EXPO_PUBLIC_APP_VERSION or version in package.json).');
  process.exit(1);
}

const path = `release-notes/v${version}.md`;
if (!existsSync(path)) {
  console.error(`⛔ ${path} not found. Add release notes before submitting.`);
  process.exit(1);
}

console.log(`✓ ${path} present.`);
