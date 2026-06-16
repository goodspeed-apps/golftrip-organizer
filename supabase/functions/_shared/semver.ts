/**
 * Parse a semver string into [major, minor, patch].
 * Strips pre-release and build metadata (anything after '-' or '+').
 * Throws if the string is not a valid MAJOR.MINOR.PATCH triplet.
 */
function parse(v: string): [number, number, number] {
  const core = v.split(/[-+]/)[0];
  const parts = core.split('.');
  if (parts.length !== 3) throw new Error(`Invalid semver: "${v}"`);
  const nums = parts.map((p) => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || String(n) !== p) {
      throw new Error(`Invalid semver segment "${p}" in "${v}"`);
    }
    return n;
  });
  return nums as [number, number, number];
}

/**
 * Compare two semver strings.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);

  for (const [av, bv] of [[aMaj, bMaj], [aMin, bMin], [aPatch, bPatch]] as [number, number][]) {
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}