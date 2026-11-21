// The weapon wheel: hold Q (or Tab) to open a radial overlay with
// the five weapons — fists, pistol, SMG, shotgun, rifle — pick one
// with the mouse angle or the number keys 1–4 (0 for fists), release
// to close. The wheel pauses nothing: the city keeps moving while
// Mara chooses, exactly like the real thing. This module owns the
// open/close state and the selection; combat.js owns the shooting.

import { WEAPON_ORDER, GUN_ORDER } from './combat.js';

export class WeaponWheel {
  constructor(combat) {
    this.combat = combat;
    this.open = false;
    // forceOpen pins the wheel open for the drive screenshot (the
    // capture can't hold Q).
    this.forceOpen = false;
    this.hover = null; // weapon key under the mouse angle
  }

  get isOpen() {
    return this.open || this.forceOpen;
  }

  update(input) {
    const held = input.wheelHeld;
    if (held && !this.open) {
      this.open = true;
      this.hover = this.combat.current;
    }
    if (!held && this.open) {
      this.open = false;
      if (this.hover && this.hover !== this.combat.current) {
        this.combat.select(this.hover);
      }
      this.hover = null;
    }
    // Number keys switch directly, wheel or no wheel.
    if (input.justPressed('Digit1')) this.combat.select('pistol');
    if (input.justPressed('Digit2')) this.combat.select('smg');
    if (input.justPressed('Digit3')) this.combat.select('shotgun');
    if (input.justPressed('Digit4')) this.combat.select('rifle');
    if (input.justPressed('Digit0')) this.combat.select('fists');

    // Mouse angle over the wheel picks the hovered weapon.
    if (this.isOpen) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = input.mouseX - cx;
      const dy = input.mouseY - cy;
      if (Math.hypot(dx, dy) > 40) {
        // Five segments, fists at the top, clockwise.
        let angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const seg = Math.floor(angle / (Math.PI * 2 / WEAPON_ORDER.length));
        this.hover = WEAPON_ORDER[Math.min(WEAPON_ORDER.length - 1, seg)];
      }
    }
  }

  // The wheel segments for the HUD: key, name, ammo text, active flag.
  segments() {
    return WEAPON_ORDER.map((key) => ({
      key,
      name: key === 'fists' ? 'FISTS' : key.toUpperCase(),
      ammo: key === 'fists' ? '∞' : `${this.combat.ammo[key] ?? 0} / ${this.combat.reserve[key] ?? 0}`,
      active: this.combat.current === key,
      hover: this.hover === key,
    }));
  }
}
