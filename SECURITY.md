# Security

## Authentication & Storage

- **Auth tokens** (Supabase session, OAuth state): always stored in `expo-secure-store` (encrypted, OS keychain).
- **Non-sensitive app state** (notification prefs, device ID for telemetry, onboarding completion): stored in `AsyncStorage` for performance.
- **Never** put auth tokens, secrets, payment data, or PII in AsyncStorage.

If you add new state, ask: "Would an attacker with physical device + root be able to derive value from this?" If yes → secure-store. If no → AsyncStorage is fine.

## Status (as of 2026-05-12)

`pnpm audit --prod` reports **0 vulnerabilities**.

The 11 previously documented advisories were all resolved via targeted `npm overrides` in `package.json` — without an Expo SDK upgrade. See "Resolved 2026-05-12" below.

## Resolved 2026-05-12 (via npm overrides)

The following advisories were closed by forcing patched transitive versions in `package.json` → `overrides`:

### High severity (chain 1)

- **tar** (6 advisories: GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w) — Override to `^7.5.11` (resolves to 7.5.15).
- **cacache** — Depended on vulnerable `tar`. Override to `^20.0.4`, which uses tar@7+.
- **@expo/cli** — Vulnerability chain originated from its bundled `cacache`/`tar`; both are now overridden to patched versions.
- **expo@52.0.49** — Top of the same chain; fixed transitively via tar/cacache overrides without changing the Expo SDK pin.

### Moderate severity (chain 1)

- **postcss** (GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS Stringify) — Override to `^8.5.10` (resolves to 8.5.14).
- **@expo/metro-config** — Depended on vulnerable postcss; fixed transitively via the postcss override.

### Low severity (chain 2 — jest-expo bundle)

- **@tootallnate/once** (GHSA-vpq2-c234-7xj6) — Override to `^3.0.1`.
- **http-proxy-agent** — Override to `^7.0.2`.
- **jsdom** — Override to `^26.1.0`, which depends on http-proxy-agent@^7.0.2 (patched).
- **jest-environment-jsdom** — Override to `^30.0.0` (resolves to 30.4.1), which pulls jsdom@^26.
- **jest-expo@55.0.17** — Top of this chain; fixed transitively via the four overrides above without upgrading jest-expo (which would require Expo SDK 53+).

### Override block in `package.json`

"overrides": {
  "@xmldom/xmldom": "^0.9.10",
  "tar": "^7.5.11",
  "cacache": "^20.0.4",
  "postcss": "^8.5.10",
  "@tootallnate/once": "^3.0.1",
  "jsdom": "^26.1.0",
  "http-proxy-agent": "^7.0.2",
  "jest-environment-jsdom": "^30.0.0"
}

Validated by: `pnpm audit --prod` → 0 vulnerabilities; `pnpm exec jest --selectProjects lib --selectProjects edge-functions` → 236/236 tests passing.

## Previously fixed (2026-05-12)

The following were resolved by `npm audit fix` + targeted overrides:

- `handlebars` — Critical: JS injection via AST type confusion. Fixed by `npm audit fix`.
- `lodash` — High: code injection via `_.template`, prototype pollution. Fixed by `npm audit fix`.
- `node-forge` — High: certificate chain bypass, signature forgery, RSA PKCS forgery, DoS. Fixed by `npm audit fix`.
- `fast-uri` — High: path traversal, host confusion. Fixed by `npm audit fix`.
- `flatted` — High: prototype pollution, unbounded recursion DoS. Fixed by `npm audit fix`.
- `undici` — High: WebSocket parser overflow, request smuggling, memory exhaustion, CRLF injection. Fixed by `npm audit fix`.
- `brace-expansion` — Moderate: zero-step sequence DoS. Fixed by `npm audit fix`.
- `@xmldom/xmldom` — High: XML injection (CDATA, processing instructions, comments, DocumentType). Fixed via `overrides` forcing `^0.9.10`.
- `picomatch` — High: method injection in POSIX character classes, ReDoS. Fixed by `npm audit fix`.
