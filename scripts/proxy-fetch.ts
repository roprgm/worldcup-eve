// Preload shim: make Bun's global `fetch` work behind an HTTPS proxy.
//
// Bun's native fetch negotiates HTTP/2 (ALPN h2) over a CONNECT tunnel, and that
// path is broken — every request to an HTTP/2 origin resets with ECONNRESET while
// HTTP/1.1 origins succeed. Node works because its fetch is undici, which talks
// HTTP/1.1 over proxies. So when a proxy is configured we route fetch through
// undici's ProxyAgent, matching Node's behaviour. (undici@8's fetch is incompatible
// with Bun's webidl; we pin undici@6.)
//
// Wired into the `sync:markets` script via `bun --preload`. No-ops when no proxy is
// set, so it is inert in local dev and production.

// Import the subpath, not the bare specifier: Bun shadows `"undici"` with its own
// builtin (which delegates to the same broken native fetch), so `"undici/index.js"`
// is what reaches the real npm package.
import { fetch as undiciFetch, ProxyAgent } from "undici/index.js";

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;

function noProxyMatcher(): (host: string) => boolean {
  const raw = process.env.NO_PROXY ?? process.env.no_proxy ?? "";
  const rules = raw
    .split(",")
    .map((r) =>
      r
        .trim()
        .replace(/^\*?\./, "")
        .toLowerCase(),
    )
    .filter(Boolean);
  return (host: string) => {
    const h = host.toLowerCase();
    return rules.some((rule) => h === rule || h.endsWith(`.${rule}`));
  };
}

if (proxy) {
  const dispatcher = new ProxyAgent(proxy);
  const bypass = noProxyMatcher();
  const nativeFetch = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    if (url.protocol === "http:" || bypass(url.hostname)) {
      return nativeFetch(input as never, init);
    }
    return undiciFetch(input as never, { dispatcher, ...init }) as never;
  }) as typeof fetch;
}
