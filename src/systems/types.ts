// The contract between the app shell and each kind of system.
// The engine of a system (src/engine/*) knows nothing about the UI; the module
// here binds it to a view, URL parameters and examples. Adding a system means
// adding one module to the registry, without touching the others.

import type { Component } from 'svelte';

export interface SystemViewProps<P> {
  params: P;
  /** Replace the params (also used by examples and the gallery). */
  setParams: (p: P) => void;
}

export interface Example<P> {
  id: string;
  title: string;
  /** Short explanation in Hebrew, in our own words. */
  text: string;
  /** Page in the original book, when the example comes from it. */
  page?: number | string;
  params: P;
}

export interface SystemModule<P> {
  id: string;
  /** Name in the UI (Hebrew, following docs/glossary.md). */
  title: string;
  /** Chapter in the book, e.g. "פרקים 2–3". */
  chapter?: string;
  defaults(): P;
  fromQuery(q: URLSearchParams): P;
  /** Only parameters that differ from the defaults need to be written. */
  toQuery(p: P): Record<string, string>;
  View: Component<SystemViewProps<P>>;
  examples: Example<P>[];
}
