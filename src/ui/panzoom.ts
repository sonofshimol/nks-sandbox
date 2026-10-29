// Shared zoom & pan for canvases: wheel and drag on desktop, pinch and drag on
// touch, and a tap/click that did not move. The view maps world coordinates to
// screen CSS pixels: screen = o + world * scale.

export interface View {
  scale: number;
  ox: number;
  oy: number;
}

export interface PanZoomOptions {
  view: View;
  minScale: () => number;
  maxScale: () => number;
  onChange: () => void;
  /** Click or tap without movement, in canvas CSS pixels. */
  onTap?: (x: number, y: number) => void;
  /** Drag that should paint instead of pan (return true to take over the gesture). */
  onDrawStart?: (x: number, y: number, e: PointerEvent) => boolean;
  onDrawMove?: (x: number, y: number) => void;
  onDrawEnd?: () => void;
}

export function zoomAt(o: PanZoomOptions, f: number, cx: number, cy: number) {
  const v = o.view;
  const s = Math.min(o.maxScale(), Math.max(o.minScale(), v.scale * f));
  v.ox = cx - ((cx - v.ox) * s) / v.scale;
  v.oy = cy - ((cy - v.oy) * s) / v.scale;
  v.scale = s;
  o.onChange();
}

export function attachPanZoom(canvas: HTMLCanvasElement, o: PanZoomOptions): () => void {
  const v = o.view;
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; ox: number; oy: number; moved: boolean; multi: boolean } | null = null;
  let pinch: { dist: number; wx: number; wy: number; scale: number } | null = null;
  let drawing = false;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchInfo = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };

  function down(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      if (o.onDrawStart && o.onDrawStart(p.x, p.y, e)) {
        drawing = true;
        return;
      }
      drag = { x: p.x, y: p.y, ox: v.ox, oy: v.oy, moved: false, multi: false };
    } else if (pointers.size === 2) {
      if (drawing) {
        drawing = false;
        o.onDrawEnd?.();
      }
      const { dist, mx, my } = pinchInfo();
      pinch = { dist, wx: (mx - v.ox) / v.scale, wy: (my - v.oy) / v.scale, scale: v.scale };
      if (drag) drag.multi = true;
      else drag = { x: mx, y: my, ox: v.ox, oy: v.oy, moved: true, multi: true };
    }
  }

  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (drawing) {
      o.onDrawMove?.(p.x, p.y);
      return;
    }
    if (pinch && pointers.size >= 2) {
      const { dist, mx, my } = pinchInfo();
      v.scale = Math.min(o.maxScale(), Math.max(o.minScale(), (pinch.scale * dist) / Math.max(1, pinch.dist)));
      v.ox = mx - pinch.wx * v.scale;
      v.oy = my - pinch.wy * v.scale;
      o.onChange();
    } else if (drag && pointers.size === 1) {
      const dx = p.x - drag.x;
      const dy = p.y - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.moved) {
        v.ox = drag.ox + dx;
        v.oy = drag.oy + dy;
        o.onChange();
      }
    }
  }

  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (drawing) {
      drawing = false;
      o.onDrawEnd?.();
      return;
    }
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { x: p.x, y: p.y, ox: v.ox, oy: v.oy, moved: true, multi: true };
      return;
    }
    if (pointers.size === 0 && drag) {
      if (!drag.moved && !drag.multi && e.type === 'pointerup' && o.onTap) {
        const p = local(e);
        o.onTap(p.x, p.y);
      }
      drag = null;
    }
  }

  function wheel(e: WheelEvent) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const p = local(e);
    zoomAt(o, Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('wheel', wheel);
  };
}
