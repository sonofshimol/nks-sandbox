// The whole state lives in the query string, so every view can be shared as a link.

export function readQuery(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function buildQuery(entries: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) if (v != null && v !== '') q.set(k, v);
  const s = q.toString();
  return s ? '?' + s : '';
}

let timer = 0;

/** Replace the URL (debounced, so dragging a slider does not flood the history API). */
export function writeQuery(query: string) {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (query !== location.search) history.replaceState(null, '', location.pathname + query + location.hash);
  }, 120);
}
