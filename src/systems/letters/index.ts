import type { SystemModule } from '../types';
import { defaults, fromQuery, toQuery, type LettersParams } from './params';
import View from './View.svelte';

export const letters: SystemModule<LettersParams> = {
  id: 'letters',
  title: 'אוטומט האותיות',
  defaults,
  fromQuery,
  toQuery,
  View,
  examples: [],
};
