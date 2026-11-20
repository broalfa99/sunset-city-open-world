// Sunset City — keyboard + mouse state, with edge-triggered "just pressed" keys.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    justPressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 },
    canvas,
  };

  const GAME_KEYS = new Set([
    'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyR',
    'KeyP', 'KeyM', 'Enter', 'Escape', 'Tab',
  ]);

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      input.keys.add(e.code);
      input.justPressed.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

export function isDown(input, code) {
  return input.keys.has(code);
}

export function wasPressed(input, code) {
  return input.justPressed.has(code);
}

export function axisDown(input) {
  // Returns {x, y} in [-1, 1] from WASD / arrows.
  let x = 0;
  let y = 0;
  if (isDown(input, 'KeyA') || isDown(input, 'ArrowLeft')) x -= 1;
  if (isDown(input, 'KeyD') || isDown(input, 'ArrowRight')) x += 1;
  if (isDown(input, 'KeyW') || isDown(input, 'ArrowUp')) y -= 1;
  if (isDown(input, 'KeyS') || isDown(input, 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.SQRT2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}

// Call once at the end of each frame: clears edge-triggered state.
export function endFrame(input) {
  input.justPressed.clear();
  input.mouse.clicked = false;
}
