// WebGL2 Lenia / SmoothLife. The state is an R32F texture (needs
// EXT_color_buffer_float to render into float textures). The kernel weights live
// in an RG32F texture: R = Lenia kernel or SmoothLife disk, G = SmoothLife ring.

import { leniaKernel, smoothKernels, type LeniaParams } from '../engine/lenia';
import { hexToRgb } from '../engine/palette';

const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const STEP_FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uState;
uniform sampler2D uKernel;
uniform ivec2 uSize;
uniform int uR;
uniform int uMode;
uniform float uMu, uSigma, uT;
uniform float uB1, uB2, uD1, uD2, uDt;
out vec4 outColor;

float sig(float x, float a, float w) { return 1.0 / (1.0 + exp(-(x - a) * 4.0 / w)); }

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float a = texelFetch(uState, p, 0).r;
  float u = 0.0;
  float v = 0.0;
  for (int dy = -uR; dy <= uR; dy++)
    for (int dx = -uR; dx <= uR; dx++) {
      vec2 k = texelFetch(uKernel, ivec2(dx + uR, dy + uR), 0).rg;
      if (k.r == 0.0 && k.g == 0.0) continue;
      ivec2 q = ((p + ivec2(dx, dy)) % uSize + uSize) % uSize;
      float s = texelFetch(uState, q, 0).r;
      u += k.r * s;
      v += k.g * s;
    }
  float na;
  if (uMode == 0) {
    float g = 2.0 * exp(-((u - uMu) * (u - uMu)) / (2.0 * uSigma * uSigma)) - 1.0;
    na = a + g / uT;
  } else {
    float alive = sig(u, 0.5, 0.147);
    float lo = mix(uB1, uD1, alive);
    float hi = mix(uB2, uD2, alive);
    float s = sig(v, lo, 0.028) * (1.0 - sig(v, hi, 0.028));
    na = a + uDt * (2.0 * s - 1.0);
  }
  outColor = vec4(clamp(na, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const DRAW_FS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uState;
uniform sampler2D uRamp;
uniform ivec2 uSize;
uniform vec2 uCanvas;
uniform float uScale;
uniform vec2 uOffset;
uniform vec3 uBg;
out vec4 outColor;
void main() {
  vec2 pix = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 world = (pix - uOffset) / uScale;
  ivec2 c = ivec2(floor(world));
  if (world.x < 0.0 || world.y < 0.0 || c.x >= uSize.x || c.y >= uSize.y) { outColor = vec4(uBg, 1.0); return; }
  float v = texelFetch(uState, c, 0).r;
  outColor = vec4(texelFetch(uRamp, ivec2(int(clamp(v, 0.0, 1.0) * 255.0), 0), 0).rgb, 1.0);
}`;

const BRUSH_FS = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uValue; // -1 erase, otherwise add random-ish bump
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float a = texelFetch(uState, p, 0).r;
  float d = distance(vec2(p) + 0.5, uCenter);
  if (d < uRadius) {
    a = uValue < 0.0 ? 0.0 : max(a, hash(vec2(p)) * uValue);
  }
  outColor = vec4(a, 0.0, 0.0, 1.0);
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

export class LeniaGL {
  gl: WebGL2RenderingContext;
  W = 0;
  H = 0;
  private stepP;
  private drawP;
  private brushP;
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private cur = 0;
  private kernel: WebGLTexture;
  private ramp: WebGLTexture;
  params!: LeniaParams;

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float');
    this.gl = gl;
    this.stepP = program(gl, STEP_FS);
    this.drawP = program(gl, DRAW_FS);
    this.brushP = program(gl, BRUSH_FS);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.kernel = gl.createTexture()!;
    this.ramp = gl.createTexture()!;
  }

  private nearest(t: WebGLTexture) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setSize(W: number, H: number, values: Float32Array) {
    const gl = this.gl;
    for (const t of this.tex) gl.deleteTexture(t);
    for (const f of this.fbo) gl.deleteFramebuffer(f);
    this.W = W;
    this.H = H;
    this.tex = [];
    this.fbo = [];
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      this.nearest(t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, H, 0, gl.RED, gl.FLOAT, i === 0 ? values : null);
      const f = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      this.tex.push(t);
      this.fbo.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.cur = 0;
  }

  setParams(p: LeniaParams) {
    const gl = this.gl;
    const changedKernel = !this.params || this.params.R !== p.R || this.params.mode !== p.mode;
    this.params = { ...p };
    if (!changedKernel) return;
    const n = 2 * p.R + 1;
    const data = new Float32Array(n * n * 2);
    if (p.mode === 'lenia') {
      const k = leniaKernel(p.R);
      for (let i = 0; i < n * n; i++) data[2 * i] = k[i];
    } else {
      const { disk, ring } = smoothKernels(p.R);
      for (let i = 0; i < n * n; i++) {
        data[2 * i] = disk[i];
        data[2 * i + 1] = ring[i];
      }
    }
    this.nearest(this.kernel);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, n, n, 0, gl.RG, gl.FLOAT, data);
  }

  setRamp(colors: string[]) {
    const gl = this.gl;
    const data = new Uint8Array(256 * 4);
    const stops = colors.map(hexToRgb);
    for (let i = 0; i < 256; i++) {
      const t = (i / 255) * (stops.length - 1);
      const a = Math.floor(t);
      const b = Math.min(stops.length - 1, a + 1);
      const f = t - a;
      for (let j = 0; j < 3; j++) data[i * 4 + j] = stops[a][j] + (stops[b][j] - stops[a][j]) * f;
      data[i * 4 + 3] = 255;
    }
    this.nearest(this.ramp);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  private pass(prog: { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }, set: () => void) {
    const gl = this.gl;
    const next = 1 - this.cur;
    gl.useProgram(prog.p);
    gl.viewport(0, 0, this.W, this.H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[next]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.uniform1i(prog.u.uState, 0);
    set();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.cur = next;
  }

  step(n = 1) {
    const gl = this.gl;
    const p = this.params;
    const u = this.stepP.u;
    for (let i = 0; i < n; i++)
      this.pass(this.stepP, () => {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.kernel);
        gl.uniform1i(u.uKernel, 1);
        gl.uniform2i(u.uSize, this.W, this.H);
        gl.uniform1i(u.uR, p.R);
        gl.uniform1i(u.uMode, p.mode === 'lenia' ? 0 : 1);
        gl.uniform1f(u.uMu, p.mu);
        gl.uniform1f(u.uSigma, p.sigma);
        gl.uniform1f(u.uT, p.T);
        gl.uniform1f(u.uB1, p.b1);
        gl.uniform1f(u.uB2, p.b2);
        gl.uniform1f(u.uD1, p.d1);
        gl.uniform1f(u.uD2, p.d2);
        gl.uniform1f(u.uDt, p.dt);
      });
  }

  brush(x: number, y: number, radius: number, value: number) {
    const gl = this.gl;
    const u = this.brushP.u;
    this.pass(this.brushP, () => {
      gl.uniform2f(u.uCenter, x, y);
      gl.uniform1f(u.uRadius, radius);
      gl.uniform1f(u.uValue, value);
    });
  }

  draw(scale: number, ox: number, oy: number, dpr: number, bg: string) {
    const gl = this.gl;
    const u = this.drawP.u;
    gl.useProgram(this.drawP.p);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.cur]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.ramp);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uRamp, 1);
    gl.uniform2i(u.uSize, this.W, this.H);
    gl.uniform2f(u.uCanvas, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uScale, scale * dpr);
    gl.uniform2f(u.uOffset, ox * dpr, oy * dpr);
    const c = hexToRgb(bg).map((v) => v / 255);
    gl.uniform3f(u.uBg, c[0], c[1], c[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  read(): Float32Array {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.cur]);
    const buf = new Float32Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.FLOAT, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const out = new Float32Array(this.W * this.H);
    for (let i = 0; i < out.length; i++) out[i] = buf[4 * i];
    return out;
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
