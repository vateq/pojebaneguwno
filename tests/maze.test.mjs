import test from 'node:test';
import assert from 'node:assert/strict';
import { createMaze, route } from '../src/maze.js';

test('every generated maze has an escape route with two required panels', () => {
  for (let seed = 0; seed < 300; seed++) {
    const maze = createMaze(seed);
    const lowerGate = maze.barriers.get(maze.key(maze.lowerRoute[0], maze.lowerRoute[1]));
    const upperGate = maze.barriers.get(maze.key(maze.upperRoute.at(-2), maze.exit));
    assert.equal(lowerGate?.type, 'panel', `lower panel for seed ${seed}`);
    assert.equal(upperGate?.type, 'panel', `upper panel for seed ${seed}`);
    assert.ok(route(maze, maze.spawn, maze.exit, true).length, `escape route for seed ${seed}`);
    assert.equal(route(maze, maze.spawn, maze.exit).length, 0, `panels block seed ${seed}`);
    assert.ok(!maze.ladders.some(c => c.x === maze.exit.x && c.z === maze.exit.z));
  }
});
