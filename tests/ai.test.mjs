import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeePlayer, sightRange, updateAttackCharge } from '../src/ai.js';

test('a quiet player without a light can observe from beyond the close range', () => {
  const stealth = { light: false, quiet: true, crouch: false, moving: true };
  assert.ok(sightRange(stealth) < 2);
  assert.equal(canSeePlayer({ ...stealth, distance: 2.4, dot: 1, clear: true }), false);
  assert.equal(canSeePlayer({ ...stealth, light: true, distance: 2.4, dot: 1, clear: true }), true);
  assert.equal(canSeePlayer({ ...stealth, distance: 1, dot: -1, clear: true }), false);
});

test('contact must be sustained and resets after escape', () => {
  let charge = updateAttackCharge(0, true, .4);
  assert.ok(charge < 1);
  charge = updateAttackCharge(charge, false, .4);
  assert.equal(charge, 0);
  assert.equal(updateAttackCharge(.6, true, .34), 1);
});
