// App-wide reactive state shared between the shell and system views.

export const app = $state({
  /** The current state as a query string ("?sys=...&rule=..."), always up to date. */
  query: '',
});
