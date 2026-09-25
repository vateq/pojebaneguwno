export function sightRange({ light, quiet, crouch, moving }) {
  if (light) return 16;
  if (crouch) return moving ? 1.2 : .8;
  if (quiet) return moving ? 1.65 : 1.05;
  return moving ? 4.2 : 2.4;
}

export function canSeePlayer({ distance, dot, clear, light, quiet, crouch, moving }) {
  return clear && dot > .36 && distance < sightRange({ light, quiet, crouch, moving });
}

export function updateAttackCharge(charge, close, dt) {
  return Math.max(0, Math.min(1, charge + (close ? dt / .85 : -dt * 2.2)));
}
