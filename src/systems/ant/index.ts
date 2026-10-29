import type { SystemModule } from '../types';
import View, { antDefaults, antFromQuery, antToQuery, type AntParams } from './View.svelte';

export const ant: SystemModule<AntParams> = {
  id: 'ant',
  title: 'מכונת טיורינג דו־ממדית (נמלה)',
  chapter: 'פרק 5',
  defaults: antDefaults,
  fromQuery: antFromQuery,
  toQuery: antToQuery,
  View,
  examples: [],
};
