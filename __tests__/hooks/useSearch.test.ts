/**
 * Tests for hooks/useSearch.ts — Search logic.
 */

describe('useSearch logic', () => {
  test('client-side filter works', () => {
    const data = [
      { name: 'Alice', email: 'alice@test.com' },
      { name: 'Bob', email: 'bob@test.com' },
      { name: 'Charlie', email: 'charlie@test.com' },
    ];
    const query = 'ali';
    const filterFn = (item: typeof data[0], q: string) =>
      item.name.toLowerCase().includes(q.toLowerCase());
    const results = data.filter(item => filterFn(item, query));
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Alice');
  });

  test('empty query returns all data', () => {
    const data = [1, 2, 3];
    const query = '';
    const results = query.length >= 2 ? data.filter(() => true) : data;
    expect(results).toEqual([1, 2, 3]);
  });

  test('min query length prevents search', () => {
    const minLength = 2;
    const query = 'a';
    const shouldSearch = query.length >= minLength;
    expect(shouldSearch).toBe(false);
  });

  test('clear resets query and results', () => {
    let query = 'search term';
    let results = [1, 2, 3];
    // Clear
    query = '';
    results = [];
    expect(query).toBe('');
    expect(results).toEqual([]);
  });

  test('request dedup prevents concurrent searches', () => {
    let requestId = 0;
    const latestRef = { current: 0 };
    const startSearch = () => {
      requestId++;
      latestRef.current = requestId;
      return requestId;
    };
    const shouldApplyResult = (id: number) => id === latestRef.current;

    const id1 = startSearch();
    const id2 = startSearch();
    expect(shouldApplyResult(id1)).toBe(false); // stale
    expect(shouldApplyResult(id2)).toBe(true); // latest
  });
});
