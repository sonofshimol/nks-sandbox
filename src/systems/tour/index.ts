import type { SystemModule } from '../types';
import View, { type TourParams } from './View.svelte';

export const tour: SystemModule<TourParams> = {
  id: 'tour',
  title: 'סיור בפרקים 7–12',
  chapter: 'מצגות',
  defaults: () => ({ slide: 0 }),
  fromQuery: (q) => ({ slide: Math.max(0, Math.round(Number(q.get('slide')) || 0)) }),
  toQuery: (p): Record<string, string> => (p.slide ? { slide: String(p.slide) } : {}),
  View,
  examples: [],
};
