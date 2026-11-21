// 3D math for Solmar Bay: column-major 4x4 matrices (WebGL's native
// layout), a small vector toolkit, and the easing helpers the cameras
// and the steering lean on. Everything here is pure arithmetic — no
// allocations in the hot path beyond the returned arrays.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Frame-rate independent smoothing: moves `cur` toward `target` with a
// time constant of roughly 1/rate seconds.
export function damp(cur, target, rate, dt) {
  return lerp(cur, target, 1 - Math.exp(-rate * dt));
}

// Shortest-arc interpolation between two headings.
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Shortest signed difference between two headings.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// --- vectors (plain [x, y, z] arrays) -------------------------------------

export function v3(x, y, z) {
  return [x, y, z];
}

export function v3sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function v3cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function v3len(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

export function v3norm(a) {
  const l = v3len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// --- matrices (Float32Array(16), column-major) -----------------------------

export function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function mat4LookAt(eye, target, up) {
  const f = v3norm(v3sub(target, eye));
  const s = v3norm(v3cross(f, up));
  const u = v3cross(s, f);
  const m = mat4Identity();
  m[0] = s[0]; m[4] = s[1]; m[8] = s[2];
  m[1] = u[0]; m[5] = u[1]; m[9] = u[2];
  m[2] = -f[0]; m[6] = -f[1]; m[10] = -f[2];
  m[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
  m[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
  m[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
  return m;
}

export function mat4Translate(x, y, z) {
  const m = mat4Identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function mat4RotateY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = mat4Identity();
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  return m;
}

export function mat4RotateX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = mat4Identity();
  m[5] = c; m[6] = s;
  m[9] = -s; m[10] = c;
  return m;
}

export function mat4RotateZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = mat4Identity();
  m[0] = c; m[1] = s;
  m[4] = -s; m[5] = c;
  return m;
}

export function mat4Scale(x, y, z) {
  const m = mat4Identity();
  m[0] = x; m[5] = y; m[10] = z;
  return m;
}

// Compose translate * rotateY * scale — the transform of almost every
// prop in the city.
export function mat4TRS(x, y, z, yaw, sx, sy, sz) {
  let m = mat4Translate(x, y, z);
  m = mat4Multiply(m, mat4RotateY(yaw));
  m = mat4Multiply(m, mat4Scale(sx, sy, sz));
  return m;
}

// The 3x3 normal matrix of a model matrix (upper-left, transposed inverse
// — for rotation-only transforms this is just the rotation part).
export function mat3Normal(m) {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}
