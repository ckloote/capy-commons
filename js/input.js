// input.js — keyboard, virtual joystick, camera drag/pinch
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.cam = { id: null, lastX: 0, lastY: 0, yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
    this._pinch = null;
    this._action = false;
    this._squeak = false;
    this._nap = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') this._action = true;
      if (e.code === 'KeyQ') this._squeak = true;
      if (e.code === 'KeyZ') this._nap = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    const joyBase = document.getElementById('joy-base');
    const joyThumb = document.getElementById('joy-thumb');
    this.joyBase = joyBase; this.joyThumb = joyThumb;

    const btnAction = document.getElementById('btn-action');
    const btnSqueak = document.getElementById('btn-squeak');
    const press = (el, fn) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    };
    press(btnAction, () => { this._action = true; });
    press(btnSqueak, () => { this._squeak = true; });
    press(document.getElementById('btn-nap'), () => { this._nap = true; });

    // pointer handling on the canvas: left 45% = joystick (touch), otherwise camera
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const isTouch = e.pointerType === 'touch';
      if (isTouch && e.clientX < window.innerWidth * 0.45 && this.joy.id === null) {
        this.joy.active = true;
        this.joy.id = e.pointerId;
        this.joy.ox = e.clientX; this.joy.oy = e.clientY;
        this.joy.dx = 0; this.joy.dy = 0;
        joyBase.style.display = 'block';
        joyBase.style.left = (e.clientX - 60) + 'px';
        joyBase.style.top = (e.clientY - 60) + 'px';
        joyThumb.style.transform = 'translate(0px,0px)';
      } else if (this.cam.id === null) {
        this.cam.id = e.pointerId;
        this.cam.lastX = e.clientX; this.cam.lastY = e.clientY;
      } else if (isTouch && this._pinch === null) {
        // second finger on camera side → pinch zoom
        this._pinch = { idA: this.cam.id, idB: e.pointerId, bx: e.clientX, by: e.clientY, dist: 0 };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const len = Math.hypot(dx, dy), max = 52;
        if (len > max) { dx *= max / len; dy *= max / len; }
        this.joy.dx = dx / max; this.joy.dy = dy / max;
        joyThumb.style.transform = `translate(${dx}px,${dy}px)`;
      } else if (this._pinch && (e.pointerId === this._pinch.idB || e.pointerId === this._pinch.idA)) {
        if (e.pointerId === this._pinch.idB) { this._pinch.bx = e.clientX; this._pinch.by = e.clientY; }
        else { this.cam.lastX = e.clientX; this.cam.lastY = e.clientY; }
        const d = Math.hypot(this.cam.lastX - this._pinch.bx, this.cam.lastY - this._pinch.by);
        if (this._pinch.dist > 0) this.cam.zoomDelta += (this._pinch.dist - d) * 0.02;
        this._pinch.dist = d;
      } else if (e.pointerId === this.cam.id) {
        this.cam.yawDelta += (e.clientX - this.cam.lastX) * 0.0055;
        this.cam.pitchDelta += (e.clientY - this.cam.lastY) * 0.0055;
        this.cam.lastX = e.clientX; this.cam.lastY = e.clientY;
      }
    });
    const release = (e) => {
      if (e.pointerId === this.joy.id) {
        this.joy.id = null; this.joy.active = false;
        this.joy.dx = 0; this.joy.dy = 0;
        joyBase.style.display = 'none';
      }
      if (this._pinch && (e.pointerId === this._pinch.idA || e.pointerId === this._pinch.idB)) this._pinch = null;
      if (e.pointerId === this.cam.id) this.cam.id = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.zoomDelta += e.deltaY * 0.004;
    }, { passive: false });
  }

  // movement vector in screen space: x right, y forward (up on screen)
  moveVec() {
    let x = 0, y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.joy.active) { x += this.joy.dx; y -= this.joy.dy; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(1, len) };
  }

  // edge-triggered
  takeAction() { const a = this._action; this._action = false; return a; }
  takeSqueak() { const s = this._squeak; this._squeak = false; return s; }
  takeNap() { const n = this._nap; this._nap = false; return n; }
  takeCamDeltas() {
    const d = { yaw: this.cam.yawDelta, pitch: this.cam.pitchDelta, zoom: this.cam.zoomDelta };
    this.cam.yawDelta = 0; this.cam.pitchDelta = 0; this.cam.zoomDelta = 0;
    return d;
  }
}
