import type { SystemModule } from '../types';
import { defaults, fromQuery, toQuery, type LeniaViewParams } from './params';
import View from './View.svelte';

export const lenia: SystemModule<LeniaViewParams> = {
  id: 'lenia',
  title: 'Lenia ו־SmoothLife',
  chapter: 'רציף',
  defaults: () => defaults(),
  fromQuery,
  toQuery,
  View,
  examples: [],
};
