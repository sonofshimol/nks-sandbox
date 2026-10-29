// The current palette (shared by all systems) and the user's saved palettes.

import {
  BUILTIN_PALETTES,
  DEFAULT_PALETTE_ID,
  decodePalette,
  encodePalette,
  type Palette,
} from '../engine/palette';
import { load, save } from './storage';

const SAVED_KEY = 'ca.palettes';

class Palettes {
  saved = $state<Palette[]>(load<Palette[]>(SAVED_KEY, []));
  current = $state<Palette>(BUILTIN_PALETTES[0]);

  get all(): Palette[] {
    return [...BUILTIN_PALETTES, ...this.saved];
  }

  select(id: string) {
    const p = this.all.find((p) => p.id === id);
    if (p) this.current = p;
  }

  /** Edit the current palette; editing a built-in one turns it into an unsaved custom one. */
  update(change: Partial<Pick<Palette, 'colors' | 'grid' | 'ramp'>>) {
    const base = this.current;
    this.current = {
      ...base,
      ...change,
      id: base.builtin ? 'custom' : base.id,
      name: base.builtin ? 'מותאמת' : base.name,
      builtin: false,
    };
    const i = this.saved.findIndex((p) => p.id === this.current.id);
    if (i >= 0) {
      this.saved[i] = this.current;
      save(SAVED_KEY, this.saved);
    }
  }

  saveAs(name: string) {
    const p: Palette = { ...this.current, id: 'u' + Date.now().toString(36), name, builtin: false };
    this.saved.push(p);
    this.current = p;
    save(SAVED_KEY, this.saved);
  }

  remove(id: string) {
    this.saved = this.saved.filter((p) => p.id !== id);
    save(SAVED_KEY, this.saved);
    if (this.current.id === id) this.current = BUILTIN_PALETTES[0];
  }

  /** URL value: a built-in id, or the encoded colors for anything else. */
  toQuery(): string | null {
    if (this.current.builtin) return this.current.id === DEFAULT_PALETTE_ID ? null : this.current.id;
    return encodePalette(this.current);
  }

  fromQuery(v: string | null) {
    if (!v) {
      this.current = BUILTIN_PALETTES[0];
      return;
    }
    const builtin = BUILTIN_PALETTES.find((p) => p.id === v);
    if (builtin) {
      this.current = builtin;
      return;
    }
    const decoded = decodePalette(v);
    if (!decoded) return;
    const match = this.saved.find((p) => encodePalette(p) === v);
    this.current = match ?? decoded;
  }
}

export const palettes = new Palettes();
