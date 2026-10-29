// WebGL2 simulation and display of 2D Life-like rules.
// State lives on the GPU in RG8UI textures: R = cell state, G = age (generations
// the cell has stayed alive, capped at 255). Two textures ping-pong each step.
// A small ring of extra textures keeps recent generations for "back in time".

import { maxCount, type LifeRule } from '../engine/life';
import { hexToRgb } from '../engine/palette';

const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const STEP_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform usampler2D uTable;
uniform ivec2 uSize;
uniform int uRange;
uniform int uStates;
uniform int uMode;      // 0: counting rules, 1: WireWorld
uniform bool uCenter;
uniform bool uVN;
uniform bool uWrap;
out uvec4 outColor;

uint cellAt(ivec2 p) {
  if (uWrap) {
    p = ((p % uSize) + uSize) % uSize;
  } else if (p.x < 0 || p.y < 0 || p.x >= uSize.x || p.y >= uSize.y) {
    return 0u;
  }
  return texelFetch(uState, p, 0).r;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  uvec2 s = texelFetch(uState, p, 0).rg;
  uint st = s.r;
  uint age = s.g;
  uint ns = 0u;
  if (uMode == 1) {
    if (st == 1u) ns = 2u;
    else if (st == 2u) ns = 3u;
    else if (st == 3u) {
      int h = 0;
      for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
          if ((dx != 0 || dy != 0) && cellAt(p + ivec2(dx, dy)) == 1u) h++;
      ns = (h == 1 || h == 2) ? 1u : 3u;
    }
  } else {
    int count = 0;
    for (int dy = -uRange; dy <= uRange; dy++)
      for (int dx = -uRange; dx <= uRange; dx++) {
        if (uVN && abs(dx) + abs(dy) > uRange) continue;
        if (dx == 0 && dy == 0 && !uCenter) continue;
        if (cellAt(p + ivec2(dx, dy)) == 1u) count++;
      }
    if (st == 0u) ns = texelFetch(uTable, ivec2(count, 0), 0).r;
    else if (st == 1u) ns = texelFetch(uTable, ivec2(count, 1), 0).r == 1u ? 1u : (uStates > 2 ? 2u : 0u);
    else ns = (st + 1u) % uint(uStates);
  }
  uint na = (ns == st && ns != 0u) ? min(age + 1u, 255u) : 0u;
  outColor = uvec4(ns, na, 0u, 1u);
}`;

const DRAW_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uState;
uniform sampler2D uPalette;
uniform ivec2 uSize;
uniform vec2 uCanvas;   // device pixels
uniform float uScale;   // device pixels per cell
uniform vec2 uOffset;   // device pixels: screen position of cell (0,0)
uniform vec4 uGrid;     // rgb + alpha (0 = no lines)
uniform vec3 uBg;
uniform bool uAge;
out vec4 outColor;

vec3 ageColor(float a) {
  // viridis-like ramp, readable for color-blind viewers
  float t = clamp(log2(a + 1.0) / 8.0, 0.0, 1.0);
  vec3 c0 = vec3(0.992, 0.906, 0.145);
  vec3 c1 = vec3(0.369, 0.788, 0.384);
  vec3 c2 = vec3(0.129, 0.569, 0.549);
  vec3 c3 = vec3(0.231, 0.322, 0.545);
  vec3 c4 = vec3(0.267, 0.004, 0.329);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  vec2 pix = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 world = (pix - uOffset) / uScale;
  ivec2 c = ivec2(floor(world));
  if (world.x < 0.0 || world.y < 0.0 || c.x >= uSize.x || c.y >= uSize.y) {
    outColor = vec4(uBg, 1.0);
    return;
  }
  uvec2 s = texelFetch(uState, c, 0).rg;
  vec3 col;
  if (uAge && s.r == 1u) col = ageColor(float(s.g));
  else col = texelFetch(uPalette, ivec2(int(s.r), 0), 0).rgb;
  if (uGrid.a > 0.0) {
    vec2 f = fract(world) * uScale;
    float lw = 1.0;
    if (f.x < lw || f.y < lw) col = mix(col, uGrid.rgb, uGrid.a);
  }
  outColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error');
  return sh;
}

function program(gl: WebGL2RenderingContext, fs: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i)!.name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

export interface DrawView {
  scale: number; // CSS px per cell
  ox: number;
  oy: number;
  dpr: number;
  grid: string | null;
  gridAlpha: number;
  bg: string;
  age: boolean;
}

export class LifeGL {
  gl: WebGL2RenderingContext;
  W = 0;
  H = 0;
  private stepProg;
  private drawProg;
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private cur = 0;
  private table: WebGLTexture;
  private palette: WebGLTexture;
  private rule!: LifeRule;
  wrap = true;
  // history ring
  private hist: { tex: WebGLTexture; fbo: WebGLFramebuffer; gen: number }[] = [];
  private histStart = 0;
  private histLen = 0;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.stepProg = program(gl, STEP_FS);
    this.drawProg = program(gl, DRAW_FS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.table = gl.createTexture()!;
    this.palette = gl.createTexture()!;
  }

  private makeStateTex(W: number, H: number, data: Uint8Array | null) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8UI, W, H, 0, gl.RG_INTEGER, gl.UNSIGNED_BYTE, data);
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t, f };
  }

  /** (Re)allocate the grid; `cells` holds one state byte per cell. */
  setSize(W: number, H: number, cells?: Uint8Array) {
    const gl = this.gl;
    for (const t of this.tex) gl.deleteTexture(t);
    for (const f of this.fbo) gl.deleteFramebuffer(f);
    for (const h of this.hist) {
      gl.deleteTexture(h.tex);
      gl.deleteFramebuffer(h.fbo);
    }
    this.W = W;
    this.H = H;
    const data = new Uint8Array(W * H * 2);
    if (cells) for (let i = 0; i < W * H; i++) data[2 * i] = cells[i];
    const a = this.makeStateTex(W, H, data);
    const b = this.makeStateTex(W, H, null);
    this.tex = [a.t, b.t];
    this.fbo = [a.f, b.f];
    this.cur = 0;
    // History: as many snapshots as fit in ~48 MB of GPU memory, at most 64.
    const n = Math.max(4, Math.min(64, Math.floor((48 * 1024 * 1024) / (W * H * 2))));
    this.hist = Array.from({ length: n }, () => {
      const h = this.makeStateTex(W, H, null);
      return { tex: h.t, fbo: h.f, gen: 0 };
    });
    this.histStart = 0;
    this.histLen = 0;
  }

  setRule(rule: LifeRule) {
    const gl = this.gl;
    this.rule = rule;
    const m = maxCount(rule.range, rule.vonNeumann, rule.center) + 1;
    const data = new Uint8Array(m * 2);
    for (let i = 0; i < m; i++) {
      data[i] = rule.birth[i] ? 1 : 0;
      data[m + i] = rule.survive[i] ? 1 : 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.table);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, m, 2, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
  }

  setPalette(colors: string[]) {
    const gl = this.gl;
    const data = new Uint8Array(256 * 4);
    colors.forEach((c, i) => {
      const [r, g, b] = hexToRgb(c);
      data.set([r, g, b, 255], i * 4);
    });
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  /** Save the current generation into the history ring. */
  snapshot(gen: number) {
    const gl = this.gl;
    const i = (this.histStart + this.histLen) % this.hist.length;
    if (this.histLen === this.hist.length) this.histStart = (this.histStart + 1) % this.hist.length;
    else this.histLen++;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo[this.cur]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.hist[i].fbo);
    gl.blitFramebuffer(0, 0, this.W, this.H, 0, 0, this.W, this.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    this.hist[i].gen = gen;
  }

  get historySize() {
    return this.histLen;
  }

  /** Restore the most recent snapshot; returns its generation, or null if none. */
  back(): number | null {
    if (!this.histLen) return null;
    const gl = this.gl;
    const i = (this.histStart + this.histLen - 1) % this.hist.length;
    this.histLen--;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.hist[i].fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo[this.cur]);
    gl.blitFramebuffer(0, 0, this.W, this.H, 0, 0, this.W, this.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    return this.hist[i].gen;
  }

  clearHistory() {
    this.histLen = 0;
  }

  step(n = 1) {
    const gl = this.gl;
    const { p, u } = this.stepProg;
    gl.useProgram(p);
    gl.viewport(0, 0, this.W, this.H);
    gl.uniform2i(u.uSize, this.W, this.H);
    gl.uniform1i(u.uRange, this.rule.range);
    gl.uniform1i(u.uStates, this.rule.states);
    gl.uniform1i(u.uMode, this.rule.family === 'wireworld' ? 1 : 0);
    gl.uniform1i(u.uCenter, this.rule.center ? 1 : 0);
    gl.uniform1i(u.uVN, this.rule.vonNeumann ? 1 : 0);
    gl.uniform1i(u.uWrap, this.wrap ? 1 : 0);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uTable, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.table);
    for (let i = 0; i < n; i++) {
      const next = 1 - this.cur;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[next]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.cur = next;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  draw(v: DrawView) {
    const gl = this.gl;
    const { p, u } = this.drawProg;
    gl.useProgram(p);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uPalette, 1);
    gl.uniform2i(u.uSize, this.W, this.H);
    gl.uniform2f(u.uCanvas, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uScale, v.scale * v.dpr);
    gl.uniform2f(u.uOffset, v.ox * v.dpr, v.oy * v.dpr);
    const g = v.grid ? hexToRgb(v.grid).map((x) => x / 255) : [0, 0, 0];
    gl.uniform4f(u.uGrid, g[0], g[1], g[2], v.grid ? v.gridAlpha : 0);
    const bg = hexToRgb(v.bg).map((x) => x / 255);
    gl.uniform3f(u.uBg, bg[0], bg[1], bg[2]);
    gl.uniform1i(u.uAge, v.age ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Read a rectangle of states from the current (or previous) generation. */
  read(x: number, y: number, w: number, h: number, previous = false): Uint8Array {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[previous ? 1 - this.cur : this.cur]);
    const out = new Uint8Array(w * h);
    const fmt = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT);
    const type = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
    if (fmt === gl.RG_INTEGER && type === gl.UNSIGNED_BYTE) {
      const buf = new Uint8Array(w * h * 2);
      gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
      gl.readPixels(x, y, w, h, gl.RG_INTEGER, gl.UNSIGNED_BYTE, buf);
      for (let i = 0; i < w * h; i++) out[i] = buf[2 * i];
    } else {
      const buf = new Uint32Array(w * h * 4);
      gl.readPixels(x, y, w, h, gl.RGBA_INTEGER, gl.UNSIGNED_INT, buf);
      for (let i = 0; i < w * h; i++) out[i] = buf[4 * i];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  readAll(): Uint8Array {
    return this.read(0, 0, this.W, this.H);
  }

  /** Write states into a rectangle of the current generation (ages reset). */
  write(x: number, y: number, w: number, h: number, cells: Uint8Array) {
    const gl = this.gl;
    // Clip to the grid
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.W, x + w);
    const y1 = Math.min(this.H, y + h);
    if (x1 <= x0 || y1 <= y0) return;
    const cw = x1 - x0;
    const ch = y1 - y0;
    const data = new Uint8Array(cw * ch * 2);
    for (let yy = 0; yy < ch; yy++)
      for (let xx = 0; xx < cw; xx++) data[2 * (yy * cw + xx)] = cells[(yy + y0 - y) * w + (xx + x0 - x)];
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, cw, ch, gl.RG_INTEGER, gl.UNSIGNED_BYTE, data);
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
