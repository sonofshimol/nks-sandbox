import type { SystemModule } from '../types';
import View, { numDefaults, numFromQuery, numToQuery, type NumbersParams } from './View.svelte';

export const numbers: SystemModule<NumbersParams> = {
  id: 'numbers',
  title: 'מערכות מבוססות מספרים',
  chapter: 'פרק 4',
  defaults: () => numDefaults(),
  fromQuery: numFromQuery,
  toQuery: numToQuery,
  View,
  examples: [],
};
