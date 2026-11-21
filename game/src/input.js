// Solmar Bay v4 — keyboard + mouse input.
//
// Tracks held keys and one-frame "just pressed" edges. The game loop
// calls endFrame() after each update so edges only fire once. Keys
// are read by `code` (KeyW, ArrowUp, Digit1...) so layouts don't
// matter, and the module exposes semantic axes for driving.

const DRIVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export function makeInput() {
  const down = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mousePressed = false;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    down.delete(e.code);
  }
  function onMouseDown(e) {
    mouseDown = true;
    mousePressed = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onBlur() {
    down.clear();
    pressed.clear();
    mouseDown = false;
    mousePressed = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  function anyOf(codes) {
    return codes.some((c) => down.has(c));
  }

  return {
    isDown(code) { return down.has(code); },
    wasPressed(code) { return pressed.has(code); },
    get mouse() { return { down: mouseDown, x: mouseX, y: mouseY }; },
    // Latched one-frame edge: a fast click between frames still fires.
    get mousePressed() { return mousePressed; },
    // -1..1 steering (left negative) and throttle (forward positive).
    get steer() {
      return (anyOf(DRIVE_KEYS.right) ? 1 : 0) - (anyOf(DRIVE_KEYS.left) ? 1 : 0);
    },
    get throttle() {
      return (anyOf(DRIVE_KEYS.forward) ? 1 : 0) - (anyOf(DRIVE_KEYS.back) ? 1 : 0);
    },
    get sprint() { return down.has('ShiftLeft') || down.has('ShiftRight'); },
    get brake() { return down.has('Space'); },
    endFrame() {
      pressed.clear();
      mousePressed = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
