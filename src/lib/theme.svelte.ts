// Light by default; dark only when chosen explicitly.

import { load, save } from './storage';

const KEY = 'ca.theme';

class Theme {
  dark = $state(load<boolean>(KEY, false));

  constructor() {
    this.apply();
  }

  toggle() {
    this.dark = !this.dark;
    save(KEY, this.dark);
    this.apply();
  }

  private apply() {
    if (typeof document === 'undefined') return;
    if (this.dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
  }
}

export const theme = new Theme();
