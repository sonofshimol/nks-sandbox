import type { SystemModule } from '../types';
import { examples } from './examples';
import { defaults, fromQuery, toQuery, type CA1DParams } from './params';
import View from './View.svelte';

export const ca1d: SystemModule<CA1DParams> = {
  id: 'ca1d',
  title: 'אוטומטים תאיים חד־ממדיים',
  chapter: 'פרקים 2–3',
  defaults,
  fromQuery,
  toQuery,
  View,
  examples,
};
