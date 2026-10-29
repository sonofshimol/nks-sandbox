// All systems, in the order of the book. To add a system, add its module here.

import { ant } from './ant';
import { ca1d } from './ca1d';
import { letters } from './letters';
import { lenia } from './lenia';
import { life } from './life';
import { networks } from './networks';
import { numbers } from './numbers';
import { programs } from './programs';
import { tour } from './tour';
import type { SystemModule } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const systems: SystemModule<any>[] = [ca1d, programs, numbers, ant, life, networks, lenia, tour, letters];

export function findSystem(id: string | null) {
  return systems.find((s) => s.id === id) ?? systems[0];
}
