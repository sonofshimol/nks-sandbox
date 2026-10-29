export { mobileCode, mobileFromCode, parseRegProgram, tmCode, tmFromCode } from '../../engine/programs';

/** Cells of elementary neighborhood n (0..7), left to right. */
export function neighborhoodsLabel(n: number): number[] {
  return [(n >> 2) & 1, (n >> 1) & 1, n & 1];
}
