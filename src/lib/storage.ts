// localStorage that never throws (private mode, blocked storage): it just forgets.

export function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s == null ? fallback : (JSON.parse(s) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
