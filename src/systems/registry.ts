// All systems, in the order of the book. To add a system, add its module here.

import { ca1d } from './ca1d';
import { letters } from './letters';
import { life } from './life';
import { programs } from './programs';
import type { SystemModule } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const systems: SystemModule<any>[] = [ca1d, programs, life, letters];

export function findSystem(id: string | null) {
  return systems.find((s) => s.id === id) ?? systems[0];
}
