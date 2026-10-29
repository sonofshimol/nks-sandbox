import type { SystemModule } from '../types';
import { defaults, fromQuery, toQuery, type LifeParams } from './params';
import View from './View.svelte';

export const life: SystemModule<LifeParams> = {
  id: 'life',
  title: 'משחק החיים ומשפחתו',
  chapter: 'דו־ממדי',
  defaults,
  fromQuery,
  toQuery,
  View,
  examples: [],
};
