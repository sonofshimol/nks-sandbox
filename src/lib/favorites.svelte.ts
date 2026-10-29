// Favorites: saved links (the full URL state), kept in this browser.

import { load, save } from './storage';

export interface Favorite {
  id: string;
  title: string;
  /** location.search of the saved state */
  query: string;
}

const KEY = 'ca.favorites';

class Favorites {
  list = $state<Favorite[]>(load<Favorite[]>(KEY, []));

  has(query: string): boolean {
    return this.list.some((f) => f.query === query);
  }

  toggle(title: string, query: string) {
    if (this.has(query)) this.list = this.list.filter((f) => f.query !== query);
    else this.list = [{ id: Date.now().toString(36), title, query }, ...this.list];
    save(KEY, this.list);
  }

  remove(id: string) {
    this.list = this.list.filter((f) => f.id !== id);
    save(KEY, this.list);
  }
}

export const favorites = new Favorites();
