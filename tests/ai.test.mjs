import test from 'node:test';
import assert from 'node:assert/strict';
import { beamHitsCreature, canSeePlayer, footstepNoise, inGrabRange, rearEyeCanOpen,
  sightRange, updateAttackCharge } from '../src/ai.js';

test('a quiet player without a light can observe from beyond the close range', () => {
  const stealth = { light: false, quiet: true, crouch: false, moving: true };
  assert.ok(sightRange(stealth) < 2);
  assert.equal(canSeePlayer({ ...stealth, distance: 2.4, dot: 1, clear: true }), false);
  assert.equal(canSeePlayer({ ...stealth, light: true, distance: 2.4, dot: 1, clear: true }), true);
  assert.equal(canSeePlayer({ ...stealth, distance: 1, dot: -1, clear: true }), false);
});

test('contact must be sustained and resets after escape', () => {
  let charge = updateAttackCharge(0, true, .24);
  assert.ok(charge < 1);
  charge = updateAttackCharge(charge, false, .4);
  assert.equal(charge, 0);
  assert.equal(updateAttackCharge(.6, true, .24), 1);
});

test('rear eye opens at long range, but only with an unblocked view from behind', () => {
  assert.equal(rearEyeCanOpen({ clear: true, distance: 18, dot: -.85 }), true);
  assert.equal(rearEyeCanOpen({ clear: false, distance: 18, dot: -.85 }), false);
  assert.equal(rearEyeCanOpen({ clear: true, distance: 18, dot: .5 }), false);
});

test('a flashlight beam can provoke the creature from behind', () => {
  assert.equal(beamHitsCreature({ light: true, clear: true, distance: 16, aimDot: .97 }), true);
  assert.equal(beamHitsCreature({ light: false, clear: true, distance: 16, aimDot: .97 }), false);
  assert.equal(beamHitsCreature({ light: true, clear: true, distance: 16, aimDot: .5 }), false);
});

test('mouth reach extends forward but cannot grab through a closed passage', () => {
  assert.equal(inGrabRange({ clear: true, distance: 1.9, forward: 1.8, lateral: .35 }), true);
  assert.equal(inGrabRange({ clear: true, distance: 1.9, forward: 1.8, lateral: 1.1 }), false);
  assert.equal(inGrabRange({ clear: false, distance: .3, forward: .3, lateral: 0 }), false);
});

test('walking without Shift has a much louder and longer alert than sneaking', () => {
  const loud = footstepNoise({ quiet: false, crouch: false });
  const crouched = footstepNoise({ quiet: false, crouch: true });
  const quiet = footstepNoise({ quiet: true, crouch: false });
  assert.ok(loud.radius > quiet.radius * 8);
  assert.ok(loud.rush > crouched.rush && crouched.rush > quiet.rush);
});
