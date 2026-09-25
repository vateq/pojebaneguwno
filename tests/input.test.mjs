import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGameKey, GAME_KEYS } from '../src/input.js';

function key(code, modifiers = {}) {
  const event = { code, ctrlKey: false, altKey: false, metaKey: false,
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; }, ...modifiers };
  return event;
}

test('C and W can be held together without a browser modifier', () => {
  const pressed = new Set();
  const c = key('KeyC'), w = key('KeyW');
  assert.ok(handleGameKey(c, true, pressed, true));
  assert.ok(handleGameKey(w, true, pressed, true));
  assert.deepEqual([...pressed], ['KeyC', 'KeyW']);
  assert.ok(c.prevented && w.prevented);
  assert.ok(handleGameKey(c, true, pressed, false));
  assert.deepEqual([...pressed], ['KeyW']);
});

test('all game controls are captured and reserved browser combinations are not game controls', () => {
  const pressed = new Set();
  for (const code of GAME_KEYS) {
    const event = key(code);
    assert.ok(handleGameKey(event, true, pressed, true), code);
    assert.ok(event.prevented && event.stopped, code);
  }
  const closeTab = key('KeyW', { ctrlKey: true });
  assert.equal(handleGameKey(closeTab, true, pressed, true), false);
  assert.equal(closeTab.prevented, false);
  assert.equal(GAME_KEYS.has('ControlLeft'), false);
});
