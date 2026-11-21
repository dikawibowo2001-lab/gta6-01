// Solmar Bay v4 — 3D math, written from the standard definitions.
//
// Vectors are plain [x, y, z] arrays; matrices are Float32Array(16)
// in column-major order (the layout WebGL expects). Nothing here
// allocates in the hot path except the small helpers, which the
// renderer calls a handful of times per frame.

export function v3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

export function v3Add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function v3Sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function v3Scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function v3Len(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function v3Norm(a) {
  const l = v3Len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function v3Dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function v3DistXZ(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest-arc angle interpolation, so the camera never spins the
// long way around when the player turns across the -PI/PI seam.
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// --- 4x4 matrices (column-major) ------------------------------------

export function matIdentity() {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

export function matMultiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

export function matPerspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function matLookAt(eye, target, up) {
  const zAxis = v3Norm(v3Sub(eye, target));
  const xAxis = v3Norm([
    up[1] * zAxis[2] - up[2] * zAxis[1],
    up[2] * zAxis[0] - up[0] * zAxis[2],
    up[0] * zAxis[1] - up[1] * zAxis[0],
  ]);
  const yAxis = [
    zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
    zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
    zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
  ];
  const m = matIdentity();
  m[0] = xAxis[0]; m[4] = xAxis[1]; m[8] = xAxis[2];
  m[1] = yAxis[0]; m[5] = yAxis[1]; m[9] = yAxis[2];
  m[2] = zAxis[0]; m[6] = zAxis[1]; m[10] = zAxis[2];
  m[12] = -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]);
  m[13] = -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]);
  m[14] = -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]);
  return m;
}

// Translation * rotation-Y * scale, the only transform the game
// needs for placed objects (cars, peds, props, buildings).
export function matFromTRS(pos, angleY, scale) {
  const c = Math.cos(angleY);
  const s = Math.sin(angleY);
  const sx = Array.isArray(scale) ? scale[0] : scale;
  const sy = Array.isArray(scale) ? scale[1] : scale;
  const sz = Array.isArray(scale) ? scale[2] : scale;
  const m = new Float32Array(16);
  m[0] = c * sx; m[1] = 0; m[2] = -s * sx; m[3] = 0;
  m[4] = 0; m[5] = sy; m[6] = 0; m[7] = 0;
  m[8] = s * sz; m[9] = 0; m[10] = c * sz; m[11] = 0;
  m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2]; m[15] = 1;
  return m;
}

export function matTranslate(x, y, z) {
  const m = matIdentity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
