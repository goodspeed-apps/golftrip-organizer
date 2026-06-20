// Native stub for the OPTIONAL dep `react-native-ssl-pinning`.
//
// It is intentionally NOT declared: its Android build.gradle calls the removed
// jcenter() and it pulls AFNetworking, which fails to compile against the iOS 26
// SDK — adding it ships an unbuildable app. Generated apps that import it for
// certificate pinning fall back here to the platform fetch (no pinning), so the
// bundle builds and network calls still work. metro.config.js routes here ONLY
// when the real package isn't installed.
//
// The real lib's `fetch(url, { method, headers, body })` resolves to a response
// exposing `status`, `json()`, `text()`, and `bodyString`; mirror that shape.
function fetch(url, options = {}) {
  const { method, headers, body } = options || {};
  return global.fetch(url, { method, headers, body }).then(async (res) => {
    const bodyString = await res.text();
    return {
      status: res.status,
      headers: res.headers,
      url: res.url,
      bodyString,
      text: () => bodyString,
      json: () => {
        try {
          return JSON.parse(bodyString);
        } catch {
          return null;
        }
      },
    };
  });
}

module.exports = { fetch, removeCookieByName: () => Promise.resolve() };
module.exports.default = module.exports;
