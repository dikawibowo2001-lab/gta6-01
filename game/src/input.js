// Input: keyboard state with edge-triggered "just pressed" keys, plus
// the mouse (position, buttons, and the aim vector the combat uses).
// The game reads this once per frame; endFrame() clears the edges.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.mouseDown = false;
    this.mousePressed = false;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  justPressed(code) {
    return this.pressed.has(code);
  }

  // The driving axes: throttle -1..1, steer -1..1.
  get throttle() {
    let t = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) t += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) t -= 1;
    return t;
  }

  get steer() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    return s;
  }

  get run() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }

  get handbrake() {
    return this.down('Space');
  }

  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
  }

  // Test helper: pretend a key is held, for the play-test.
  testHold(code) {
    this.keys.add(code);
    this.pressed.add(code);
  }

  testRelease(code) {
    this.keys.delete(code);
  }
}
