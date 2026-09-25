export function sightRange({ light, quiet, crouch, moving }) {
  if (light) return 16;
  if (crouch) return moving ? 1.2 : .8;
  if (quiet) return moving ? 1.65 : 1.05;
  return moving ? 4.2 : 2.4;
}

export function canSeePlayer({ distance, dot, clear, light, quiet, crouch, moving }) {
  return clear && dot > .36 && distance < sightRange({ light, quiet, crouch, moving });
}

export function beamHitsCreature({ light, clear, distance, aimDot }) {
  return light && clear && distance < 22 && aimDot > .91;
}

export function rearEyeCanOpen({ clear, distance, dot }) {
  return clear && distance < 27 && dot < -.43;
}

export function inGrabRange({ clear, distance, forward, lateral }) {
  return clear && (distance < 1.05 || (forward > .08 && forward < 2.12 && lateral < .68));
}

export function footstepNoise({ quiet, crouch }) {
  if (quiet) return { radius: 2.5, rush: 0 };
  if (crouch) return { radius: 7, rush: 1.8 };
  return { radius: 24, rush: 4 };
}

export function updateAttackCharge(charge, close, dt) {
  return Math.max(0, Math.min(1, charge + (close ? dt / .56 : -dt * 2.6)));
}
