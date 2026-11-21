// Solmar Bay v4 — raw WebGL renderer (no libraries).
//
// One shader program for everything: per-vertex colours, a single
// golden-hour directional light, and distance fog that melts the city
// into the horizon. Geometry is built from boxes, cylinders and flat
// quads, merged into as few buffers as possible: the whole static
// city is one draw call, and every dynamic object reuses a shared
// unit box drawn with a per-instance tint + transform.

import { matMultiply } from './math3.js';

const VERT = `
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform vec3 uCamPos;
uniform vec3 uTint;
varying vec3 vCol;
varying vec3 vNorm;
varying float vDist;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vCol = aCol * uTint;
  vNorm = mat3(uModel) * aNorm;
  vDist = distance(wp.xyz, uCamPos);
  gl_Position = uMVP * vec4(aPos, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vCol;
varying vec3 vNorm;
varying float vDist;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
void main() {
  vec3 n = normalize(vNorm);
  float diff = max(dot(n, normalize(uSunDir)), 0.0);
  float light = 0.58 + 0.42 * diff;
  vec3 col = vCol * light;
  float f = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

export function initGL(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true })
    || canvas.getContext('experimental-webgl');
  if (!gl) throw new Error('WebGL unavailable');
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  const ctx = {
    gl,
    prog,
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aNorm: gl.getAttribLocation(prog, 'aNorm'),
    aCol: gl.getAttribLocation(prog, 'aCol'),
    uMVP: gl.getUniformLocation(prog, 'uMVP'),
    uModel: gl.getUniformLocation(prog, 'uModel'),
    uCamPos: gl.getUniformLocation(prog, 'uCamPos'),
    uTint: gl.getUniformLocation(prog, 'uTint'),
    uSunDir: gl.getUniformLocation(prog, 'uSunDir'),
    uFogColor: gl.getUniformLocation(prog, 'uFogColor'),
    uFogNear: gl.getUniformLocation(prog, 'uFogNear'),
    uFogFar: gl.getUniformLocation(prog, 'uFogFar'),
    unitBox: null,
    viewProj: null,
    camPos: [0, 0, 0],
  };
  ctx.unitBox = makeMesh(ctx, boxGeo(1, 1, 1, [1, 1, 1]));
  return ctx;
}

// --- geometry builders ----------------------------------------------
// Each returns { pos: [], norm: [], col: [], idx: [] } in plain
// arrays; mergeGeos() joins them and makeMesh() uploads to the GPU.

function pushFace(geo, corners, normal, color) {
  const base = geo.pos.length / 3;
  for (const c of corners) {
    geo.pos.push(c[0], c[1], c[2]);
    geo.norm.push(normal[0], normal[1], normal[2]);
    geo.col.push(color[0], color[1], color[2]);
  }
  geo.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function emptyGeo() {
  return { pos: [], norm: [], col: [], idx: [] };
}

export function boxGeo(w, h, d, color, off = [0, 0, 0]) {
  const geo = emptyGeo();
  const x = w / 2, y = h / 2, z = d / 2;
  const o = off;
  const P = (px, py, pz) => [px + o[0], py + o[1], pz + o[2]];
  // +x, -x, +y, -y, +z, -z faces, each wound counter-clockwise.
  pushFace(geo, [P(x, -y, -z), P(x, y, -z), P(x, y, z), P(x, -y, z)], [1, 0, 0], color);
  pushFace(geo, [P(-x, -y, z), P(-x, y, z), P(-x, y, -z), P(-x, -y, -z)], [-1, 0, 0], color);
  pushFace(geo, [P(-x, y, -z), P(-x, y, z), P(x, y, z), P(x, y, -z)], [0, 1, 0], color);
  pushFace(geo, [P(-x, -y, z), P(-x, -y, -z), P(x, -y, -z), P(x, -y, z)], [0, -1, 0], color);
  pushFace(geo, [P(-x, -y, z), P(x, -y, z), P(x, y, z), P(-x, y, z)], [0, 0, 1], color);
  pushFace(geo, [P(x, -y, -z), P(-x, -y, -z), P(-x, y, -z), P(x, y, -z)], [0, 0, -1], color);
  return geo;
}

export function cylGeo(rTop, rBot, h, seg, color, off = [0, 0, 0]) {
  const geo = emptyGeo();
  const y0 = off[1] - h / 2, y1 = off[1] + h / 2;
  for (let i = 0; i < seg; i += 1) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const n = [(c0 + c1) / 2, 0, (s0 + s1) / 2];
    const nl = Math.hypot(n[0], n[2]) || 1;
    pushFace(geo, [
      [off[0] + c0 * rBot, y0, off[2] + s0 * rBot],
      [off[0] + c1 * rBot, y0, off[2] + s1 * rBot],
      [off[0] + c1 * rTop, y1, off[2] + s1 * rTop],
      [off[0] + c0 * rTop, y1, off[2] + s0 * rTop],
    ], [n[0] / nl, 0, n[2] / nl], color);
  }
  // Top cap as a fan around the centre point.
  const topBase = geo.pos.length / 3;
  geo.pos.push(off[0], y1, off[2]);
  geo.norm.push(0, 1, 0);
  geo.col.push(color[0], color[1], color[2]);
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    geo.pos.push(off[0] + Math.cos(a) * rTop, y1, off[2] + Math.sin(a) * rTop);
    geo.norm.push(0, 1, 0);
    geo.col.push(color[0], color[1], color[2]);
    if (i > 0) geo.idx.push(topBase, topBase + i, topBase + i + 1);
  }
  geo.idx.push(topBase, topBase + seg, topBase + 1);
  return geo;
}

// Flat horizontal quad (ground, water, roofs) at height y.
export function quadGeo(w, d, color, y = 0, off = [0, 0, 0]) {
  const geo = emptyGeo();
  const x = w / 2, z = d / 2;
  pushFace(geo, [
    [off[0] - x, y, off[2] - z],
    [off[0] - x, y, off[2] + z],
    [off[0] + x, y, off[2] + z],
    [off[0] + x, y, off[2] - z],
  ], [0, 1, 0], color);
  return geo;
}

export function mergeGeos(geos) {
  const out = emptyGeo();
  for (const g of geos) {
    const base = out.pos.length / 3;
    out.pos.push(...g.pos);
    out.norm.push(...g.norm);
    out.col.push(...g.col);
    for (const i of g.idx) out.idx.push(i + base);
  }
  return out;
}

// --- GPU meshes -------------------------------------------------------

export function makeMesh(ctx, geo) {
  const { gl } = ctx;
  const mesh = { count: geo.idx.length };
  mesh.posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.pos), gl.STATIC_DRAW);
  mesh.normBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.norm), gl.STATIC_DRAW);
  mesh.colBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.col), gl.STATIC_DRAW);
  mesh.idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.idx), gl.STATIC_DRAW);
  return mesh;
}

function bindMesh(ctx, mesh) {
  const { gl } = ctx;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
  gl.vertexAttribPointer(ctx.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ctx.aPos);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuf);
  gl.vertexAttribPointer(ctx.aNorm, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ctx.aNorm);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colBuf);
  gl.vertexAttribPointer(ctx.aCol, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ctx.aCol);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
}

export function drawMesh(ctx, mesh, model, tint = [1, 1, 1]) {
  const { gl } = ctx;
  bindMesh(ctx, mesh);
  gl.uniformMatrix4fv(ctx.uModel, false, model);
  gl.uniformMatrix4fv(ctx.uMVP, false, matMultiply(ctx.viewProj, model));
  gl.uniform3fv(ctx.uTint, tint);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

// Draw the shared unit box at a transform with a solid colour — the
// workhorse for cars, peds, props and particles.
export function drawBox(ctx, model, color) {
  drawMesh(ctx, ctx.unitBox, model, color);
}

export function beginFrame(ctx, width, height, clearColor) {
  const { gl } = ctx;
  if (gl.canvas.width !== width || gl.canvas.height !== height) {
    gl.canvas.width = width;
    gl.canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

export function setLighting(ctx, sunDir, fogColor, fogNear, fogFar) {
  const { gl } = ctx;
  gl.uniform3fv(ctx.uSunDir, sunDir);
  gl.uniform3fv(ctx.uFogColor, fogColor);
  gl.uniform1f(ctx.uFogNear, fogNear);
  gl.uniform1f(ctx.uFogFar, fogFar);
}

export function setCamera(ctx, viewProj, camPos) {
  ctx.viewProj = viewProj;
  ctx.camPos = camPos;
  ctx.gl.uniform3fv(ctx.uCamPos, camPos);
}
