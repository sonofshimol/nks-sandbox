import type { SystemModule } from '../types';
import View, { netDefaults, netFromQuery, netToQuery, type NetParams } from './View.svelte';

export const networks: SystemModule<NetParams> = {
  id: 'networks',
  title: 'מערכות רב־מסלוליות ורשתות סיבתיות',
  chapter: 'פרקים 5, 9',
  defaults: () => netDefaults(),
  fromQuery: netFromQuery,
  toQuery: netToQuery,
  View,
  examples: [],
};
