// Raw-WebGL engine, no libraries. Three shader programs — lit
// (flat-shaded, sun + fog), plain (unlit colour, for windows, lights,
// the spotlight and particles) and sky (a gradient dome with a sun disc)
// — plus a geometry builder that stamps boxes, cylinders, cones and
// quads into one big static mesh per pass.
//
// Flat shading: every face owns its vertices and its normal, so the
// low-poly edges stay crisp instead of melting into smooth gradients.

import { mat3Normal, mat4Multiply } from './math3.js';

const LIT_VERT = `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec3 aCol;
attribute float aHot;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform mat3 uNrm;
varying vec3 vCol;
varying vec3 vNrm;
varying float vHot;
varying vec3 vPos;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vPos = w.xyz;
  vNrm = uNrm * aNrm;
  vCol = aCol;
  vHot = aHot;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const LIT_FRAG = `
precision mediump float;
varying vec3 vCol;
varying vec3 vNrm;
varying float vHot;
varying vec3 vPos;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uHotCol;
uniform vec3 uEye;
void main() {
  vec3 n = normalize(vNrm);
  float d = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 c = vCol * (uAmb + uSunCol * d);
  if (vHot > 0.5) c = uHotCol;
  float f = clamp((distance(vPos, uEye) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFog, f), 1.0);
}`;

const PLAIN_VERT = `
attribute vec3 aPos;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vCol;
varying vec3 vPos;
void main() {
  vPos = (uModel * vec4(aPos, 1.0)).xyz;
  vCol = aCol;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const PLAIN_FRAG = `
precision mediump float;
varying vec3 vCol;
varying vec3 vPos;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uEye;
uniform float uAlpha;
void main() {
  float f = clamp((distance(vPos, uEye) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(vCol, uFog, f * 0.55), uAlpha);
}`;

const SKY_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SKY_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uLow;
uniform vec2 uSun;
void main() {
  vec3 c = mix(uLow, uMid, smoothstep(0.02, 0.42, vUv.y));
  c = mix(c, uTop, smoothstep(0.38, 0.95, vUv.y));
  float d = distance(vUv, uSun);
  c += vec3(1.0, 0.72, 0.38) * pow(max(0.0, 1.0 - d * 1.5), 3.0) * 0.85;
  c += vec3(1.0, 0.96, 0.82) * pow(max(0.0, 1.0 - d * 5.5), 9.0);
  gl_FragColor = vec4(c, 1.0);
}`;

function compileShader(gl, kind, src) {
  const sh = gl.createShader(kind);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader compile: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function linkProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program link: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

// One draw call's worth of triangles, uploaded once.
export class Mesh {
  constructor(gl, builder, lit) {
    this.gl = gl;
    this.lit = lit;
    this.count = builder.indices.length;
    this.vbo = gl.createBuffer();
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.indices), gl.STATIC_DRAW);
    this.stride = lit ? 10 : 6;
  }

  // Draw with a model matrix: the clip-space transform is vp * model.
  // (The model matrix alone only feeds the lighting/fog varyings.)
  draw(engine, model, vp) {
    const gl = this.gl;
    if (this.count === 0) return;
    const mvp = mat4Multiply(vp, model);
    engine.use(this.lit ? 'lit' : 'plain', model, mvp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const prog = engine.prog(this.lit ? 'lit' : 'plain');
    const stride = this.stride * 4;
    gl.enableVertexAttribArray(prog.aPos);
    gl.vertexAttribPointer(prog.aPos, 3, gl.FLOAT, false, stride, 0);
    if (this.lit) {
      gl.enableVertexAttribArray(prog.aNrm);
      gl.vertexAttribPointer(prog.aNrm, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(prog.aCol);
      gl.vertexAttribPointer(prog.aCol, 3, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(prog.aHot);
      gl.vertexAttribPointer(prog.aHot, 1, gl.FLOAT, false, stride, 36);
    } else {
      gl.enableVertexAttribArray(prog.aCol);
      gl.vertexAttribPointer(prog.aCol, 3, gl.FLOAT, false, stride, 12);
    }
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
  }
}

// Accumulates triangles in local space; call finish() to get a Mesh.
export class Builder {
  constructor(lit) {
    this.lit = lit;
    this.vertices = [];
    this.indices = [];
    this.n = 0;
  }

  vert(x, y, z, nx, ny, nz, r, g, b, hot = 0) {
    if (this.lit) {
      this.vertices.push(x, y, z, nx, ny, nz, r, g, b, hot);
    } else {
      this.vertices.push(x, y, z, r, g, b);
    }
    return this.n++;
  }

  tri(a, b, c) {
    this.indices.push(a, b, c);
  }

  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  // A flat quad facing +normal, centred at (x, y, z), sized (w, h) in
  // the plane the normal points out of. `u`/`v` are the in-plane axes.
  face(x, y, z, nx, ny, nz, ux, uy, uz, vx, vy, vz, w, h, col, hot = 0) {
    const hw = w / 2;
    const hh = h / 2;
    const p = (su, sv) => [
      x + ux * su * hw + vx * sv * hh,
      y + uy * su * hw + vy * sv * hh,
      z + uz * su * hw + vz * sv * hh,
    ];
    const a = p(-1, -1);
    const b = p(1, -1);
    const c = p(1, 1);
    const d = p(-1, 1);
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, col[0], col[1], col[2], hot);
    const i1 = this.vert(b[0], b[1], b[2], nx, ny, nz, col[0], col[1], col[2], hot);
    const i2 = this.vert(c[0], c[1], c[2], nx, ny, nz, col[0], col[1], col[2], hot);
    const i3 = this.vert(d[0], d[1], d[2], nx, ny, nz, col[0], col[1], col[2], hot);
    this.quad(i0, i1, i2, i3);
  }

  // An axis-aligned box centred at (x, y, z) with size (sx, sy, sz).
  box(x, y, z, sx, sy, sz, col, hot = 0) {
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    // +x, -x
    this.face(x + hx, y, z, 1, 0, 0, 0, 0, -1, 0, 1, 0, sz, sy, col, hot);
    this.face(x - hx, y, z, -1, 0, 0, 0, 0, 1, 0, 1, 0, sz, sy, col, hot);
    // +z, -z
    this.face(x, y, z + hz, 0, 0, 1, 1, 0, 0, 0, 1, 0, sx, sy, col, hot);
    this.face(x, y, z - hz, 0, 0, -1, -1, 0, 0, 0, 1, 0, sx, sy, col, hot);
    // +y, -y
    this.face(x, y + hy, z, 0, 1, 0, 1, 0, 0, 0, 0, 1, sx, sz, col, hot);
    this.face(x, y - hy, z, 0, -1, 0, 1, 0, 0, 0, 0, -1, sx, sz, col, hot);
  }

  // A box with a different colour on top (rooftops, crates).
  boxTop(x, y, z, sx, sy, sz, side, top) {
    this.box(x, y, z, sx, sy, sz, side);
    this.face(x, y + sy / 2 + 0.01, z, 0, 1, 0, 1, 0, 0, 0, 0, 1, sx, sz, top);
  }

  // A vertical cylinder (radialSegments sides), centred at (x, y, z).
  cylinder(x, y, z, r, h, col, seg = 10, hot = 0) {
    const top = [];
    const bot = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      top.push(this.vert(x + nx * r, y + h / 2, z + nz * r, nx, 0, nz, col[0], col[1], col[2], hot));
      bot.push(this.vert(x + nx * r, y - h / 2, z + nz * r, nx, 0, nz, col[0], col[1], col[2], hot));
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.quad(bot[i], bot[j], top[j], top[i]);
    }
    const tc = this.vert(x, y + h / 2, z, 0, 1, 0, col[0], col[1], col[2], hot);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.tri(tc, top[i], top[j]);
    }
  }

  // A cone pointing up: base radius r, height h, apex at y + h/2.
  cone(x, y, z, r, h, col, seg = 10, hot = 0) {
    const apex = this.vert(x, y + h / 2, z, 0, 1, 0, col[0], col[1], col[2], hot);
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      ring.push(this.vert(x + nx * r, y - h / 2, z + nz * r, nx, 0.4, nz, col[0], col[1], col[2], hot));
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.tri(ring[i], ring[j], apex);
    }
  }

  // A downward cone (spotlight beam): apex at the top, wide end down.
  coneDown(x, y, z, r, h, col, seg = 12) {
    const apex = this.vert(x, y + h / 2, z, 0, -1, 0, col[0], col[1], col[2]);
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      ring.push(this.vert(x + Math.cos(a) * r, y - h / 2, z + Math.sin(a) * r, Math.cos(a), 0, Math.sin(a), col[0], col[1], col[2]));
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.tri(apex, ring[j], ring[i]);
    }
  }

  // A flat disc lying on the ground (light pools, markers).
  disc(x, y, z, r, col, seg = 20) {
    const c = this.vert(x, y, z, 0, 1, 0, col[0], col[1], col[2]);
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      ring.push(this.vert(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 1, 0, col[0], col[1], col[2]));
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.tri(c, ring[i], ring[j]);
    }
  }

  finish(gl) {
    return new Mesh(gl, this, this.lit);
  }
}

// The engine: owns the GL context, the three programs and the shared
// uniforms (sun, fog, camera). Draw calls go through here.
export class Engine {
  constructor(gl) {
    this.gl = gl;
    this.programs = {};
    this.current = null;
    this.flashColor = [1, 0.2, 0.1];
    this.plainAlpha = 1;
    this.eye = [0, 10, 0];

    const lit = linkProgram(gl, LIT_VERT, LIT_FRAG);
    const plain = linkProgram(gl, PLAIN_VERT, PLAIN_FRAG);
    const sky = linkProgram(gl, SKY_VERT, SKY_FRAG);
    const loc = (p, names) => {
      const out = {};
      for (const n of names) {
        out[n] = n.startsWith('a') ? gl.getAttribLocation(p, n) : gl.getUniformLocation(p, n);
      }
      return out;
    };
    this.programs.lit = { p: lit, ...loc(lit, ['aPos', 'aNrm', 'aCol', 'aHot', 'uMVP', 'uModel', 'uNrm', 'uSunDir', 'uSunCol', 'uAmb', 'uFog', 'uFogNear', 'uFogFar', 'uHotCol', 'uEye']) };
    this.programs.plain = { p: plain, ...loc(plain, ['aPos', 'aCol', 'uMVP', 'uModel', 'uFog', 'uFogNear', 'uFogFar', 'uEye', 'uAlpha']) };
    this.programs.sky = { p: sky, ...loc(sky, ['aPos', 'uTop', 'uMid', 'uLow', 'uSun']) };

    // Full-screen triangle for the sky dome.
    this.skyVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.1, 0.1, 0.15, 1);
  }

  prog(name) {
    return this.programs[name];
  }

  use(name, model, mvp) {
    const gl = this.gl;
    const pr = this.programs[name];
    if (this.current !== name) {
      gl.useProgram(pr.p);
      this.current = name;
    }
    gl.uniformMatrix4fv(pr.uMVP, false, mvp);
    gl.uniformMatrix4fv(pr.uModel, false, model);
    if (name === 'lit') {
      gl.uniformMatrix3fv(pr.uNrm, false, mat3Normal(model));
      gl.uniform3fv(pr.uSunDir, this.sunDir);
      gl.uniform3fv(pr.uSunCol, this.sunCol);
      gl.uniform3fv(pr.uAmb, this.ambient);
      gl.uniform3fv(pr.uFog, this.fog);
      gl.uniform1f(pr.uFogNear, this.fogNear);
      gl.uniform1f(pr.uFogFar, this.fogFar);
      gl.uniform3fv(pr.uHotCol, this.flashColor);
      gl.uniform3fv(pr.uEye, this.eye);
    } else {
      gl.uniform3fv(pr.uFog, this.fog);
      gl.uniform1f(pr.uFogNear, this.fogNear);
      gl.uniform1f(pr.uFogFar, this.fogFar);
      gl.uniform3fv(pr.uEye, this.eye);
      gl.uniform1f(pr.uAlpha, this.plainAlpha);
    }
  }

  setScene(palette, eye) {
    this.sunDir = palette.sunDir;
    this.sunCol = palette.sunTint;
    this.ambient = palette.ambient;
    this.fog = palette.fog;
    this.fogNear = palette.fogNear;
    this.fogFar = palette.fogFar;
    this.eye = eye;
    this.palette = palette;
  }

  clear() {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  drawSky(sunScreen) {
    const gl = this.gl;
    const pr = this.programs.sky;
    gl.useProgram(pr.p);
    this.current = 'sky';
    gl.depthMask(false);
    gl.uniform3fv(pr.uTop, this.palette.skyTop);
    gl.uniform3fv(pr.uMid, this.palette.skyMid);
    gl.uniform3fv(pr.uLow, this.palette.skyLow);
    gl.uniform2fv(pr.uSun, sunScreen);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    gl.enableVertexAttribArray(pr.aPos);
    gl.vertexAttribPointer(pr.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
  }

  viewport(w, h) {
    this.gl.viewport(0, 0, w, h);
  }
}
