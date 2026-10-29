// Reactive layout breakpoint: phones get a full-screen canvas and a bottom sheet.

const query = '(max-width: 820px)';

class Media {
  mobile = $state(false);

  constructor() {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    this.mobile = mq.matches;
    mq.addEventListener('change', (e) => (this.mobile = e.matches));
  }
}

export const media = new Media();
