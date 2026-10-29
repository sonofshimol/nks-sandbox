import type { SystemModule } from '../types';
import { defaults, fromQuery, toQuery, type ProgramsParams } from './params';
import View from './View.svelte';

export const programs: SystemModule<ProgramsParams> = {
  id: 'programs',
  title: 'תוכניות פשוטות אחרות',
  chapter: 'פרק 3',
  defaults: () => defaults(),
  fromQuery,
  toQuery,
  View,
  examples: [],
};
