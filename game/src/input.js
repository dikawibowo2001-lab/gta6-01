// Keyboard and mouse state, read once per frame. Held keys steer the
// player; one-shot actions (confirm, pause, enter car, help, mute, restart)
// are queued as bits and consumed by the loop so a single press never
// fires twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_HELP = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;
export const ACTION_ENTER = 32;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') queued |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyH') queued |= ACTION_HELP;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
    if (event.code === 'KeyR') queued |= ACTION_RESTART;
    if (event.code === 'KeyE') queued |= ACTION_ENTER;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
    if (event.button === 0) queued |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    takeActions() {
      const actions = queued;
      queued = 0;
      const wasClicked = mouse.clicked;
      mouse.clicked = false;
      return { actions, clicked: wasClicked };
    },
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    isDown(code) {
      return keys.has(code);
    },
    sprinting() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    handbrake() {
      return keys.has('Space');
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
