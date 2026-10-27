// ──────────────────────────────────────────────
//  input.js — Keyboard + mouse input manager
// ──────────────────────────────────────────────

class Input {
  constructor() {
    // ── Keyboard ──────────────────────────────
    /** Keys currently held down. */
    this._keysDown = new Set();
    /** Keys that went down THIS frame (cleared after poll). */
    this._keysJustPressed = new Set();
    /** Keys that went up THIS frame (cleared after poll). */
    this._keysJustReleased = new Set();

    // ── Mouse ─────────────────────────────────
    /** Accumulated mouse delta since last read. */
    this._mouseDX = 0;
    this._mouseDY = 0;
    /** Mouse buttons currently held. */
    this._mouseButtons = new Set();
    /** Mouse buttons pressed this frame. */
    this._mouseJustPressed = new Set();

    // ── Pointer lock ──────────────────────────
    this._pointerLocked = false;
    /** The element we request pointer lock on. */
    this._lockTarget = null;

    // ── Bind listeners once ───────────────────
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    this._attached = false;
  }

  // ── Lifecycle ───────────────────────────────

  /**
   * Attach event listeners.  Call once during init.
   * @param {HTMLElement} lockTarget — the element to request pointer lock on
   */
  attach(lockTarget) {
    if (this._attached) return;
    this._lockTarget = lockTarget;

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);

    this._attached = true;
  }

  /** Remove all listeners (cleanup). */
  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this._attached = false;
  }

  // ── Public query API ────────────────────────

  /** True while the key is held down. Uses `event.code` values (e.g. "KeyW"). */
  isKeyDown(code) {
    return this._keysDown.has(code);
  }

  /** True only on the first frame the key was pressed. */
  isKeyPressed(code) {
    return this._keysJustPressed.has(code);
  }

  /** True only on the frame the key was released. */
  isKeyReleased(code) {
    return this._keysJustReleased.has(code);
  }

  /**
   * Consume and return accumulated mouse movement since last call.
   * @returns {{ x: number, y: number }}
   */
  getMouseDelta() {
    const dx = this._mouseDX;
    const dy = this._mouseDY;
    this._mouseDX = 0;
    this._mouseDY = 0;
    return { x: dx, y: dy };
  }

  /** True while the given mouse button is held (0 = left, 1 = middle, 2 = right). */
  isMouseDown(button = 0) {
    return this._mouseButtons.has(button);
  }

  /** True only on the first frame the button was pressed. */
  isMousePressed(button = 0) {
    return this._mouseJustPressed.has(button);
  }

  /** Whether the pointer is currently locked. */
  get isPointerLocked() {
    return this._pointerLocked;
  }

  // ── Pointer lock helpers ────────────────────

  requestPointerLock() {
    if (this._lockTarget && !this._pointerLocked) {
      this._lockTarget.requestPointerLock().catch(() => {});
    }
  }

  exitPointerLock() {
    if (this._pointerLocked) {
      document.exitPointerLock();
    }
  }

  // ── Per-frame reset (call at END of each frame) ──

  endFrame() {
    this._keysJustPressed.clear();
    this._keysJustReleased.clear();
    this._mouseJustPressed.clear();
  }

  // ── Private event handlers ──────────────────

  /** @private */
  _onKeyDown(e) {
    if (e.repeat) return;
    this._keysDown.add(e.code);
    this._keysJustPressed.add(e.code);
  }

  /** @private */
  _onKeyUp(e) {
    this._keysDown.delete(e.code);
    this._keysJustReleased.add(e.code);
  }

  /** @private */
  _onMouseMove(e) {
    if (!this._pointerLocked) return;
    this._mouseDX += e.movementX;
    this._mouseDY += e.movementY;
  }

  /** @private */
  _onMouseDown(e) {
    this._mouseButtons.add(e.button);
    this._mouseJustPressed.add(e.button);
  }

  /** @private */
  _onMouseUp(e) {
    this._mouseButtons.delete(e.button);
  }

  /** @private */
  _onPointerLockChange() {
    this._pointerLocked = document.pointerLockElement === this._lockTarget;
  }

  /** @private — clear all pressed state on focus loss */
  _onBlur() {
    this._keysDown.clear();
    this._keysJustPressed.clear();
    this._keysJustReleased.clear();
    this._mouseButtons.clear();
    this._mouseJustPressed.clear();
    this._mouseDX = 0;
    this._mouseDY = 0;
  }

  /** @private */
  _onContextMenu(e) {
    if (this._pointerLocked) e.preventDefault();
  }
}

export const input = new Input();
