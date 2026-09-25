import test from 'node:test';
import assert from 'node:assert/strict';
import { createMaze, route, adjacent, creatureRoute } from '../src/maze.js';

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

test('exit changes position and stays deep in the upper level', () => {
  const exits = new Set();
  for (let seed = 1000; seed < 1080; seed++) {
    const maze = createMaze(seed);
    exits.add(`${maze.exit.x},${maze.exit.z},${maze.exitDir}`);
    assert.ok(maze.upperRoute.length >= 20, `upper route for seed ${seed}`);
  }
  assert.ok(exits.size > 20, 'many different exit locations');
});

test('creature cannot cross intact panels or crawl-only passages', () => {
  const maze = createMaze(71);
  for (const barrier of maze.barriers.values()) {
    const a = maze.cells[barrier.a], b = maze.cells[barrier.b];
    assert.ok(!adjacent(maze, a, false, true).includes(b));
    assert.ok(adjacent(maze, a, true).includes(b));
    if (barrier.type === 'panel') {
      barrier.broken = true;
      assert.ok(adjacent(maze, a, false, true).includes(b));
      barrier.broken = false;
    }
  }
  const path = creatureRoute(maze, maze.mainLadder, maze.spawn);
  for (let i = 0; i < path.length - 1; i++)
    assert.ok(adjacent(maze, path[i], false, true).includes(path[i + 1]));
});
