export const SIZE = 12;
export const CELL = 3.6;
export const LEVEL_HEIGHT = 3.45;
export const DIRS = [
  { dx: 0, dz: -1, opposite: 2, name: 'north' },
  { dx: 1, dz: 0, opposite: 3, name: 'east' },
  { dx: 0, dz: 1, opposite: 0, name: 'south' },
  { dx: -1, dz: 0, opposite: 1, name: 'west' },
];

export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function createMaze(seed = Date.now()) {
  const rng = random(seed);
  const cells = Array.from({ length: 2 * SIZE * SIZE }, (_, id) => ({
    id, level: Math.floor(id / (SIZE * SIZE)),
    x: id % SIZE, z: Math.floor(id / SIZE) % SIZE, links: [false, false, false, false],
  }));
  const by = (x, z, level) => x < 0 || z < 0 || x >= SIZE || z >= SIZE || level < 0 || level > 1
    ? null : cells[level * SIZE * SIZE + z * SIZE + x];
  const neighbor = (cell, direction) => by(cell.x + DIRS[direction].dx, cell.z + DIRS[direction].dz, cell.level);
  const connect = (a, b, direction) => {
    a.links[direction] = true;
    b.links[DIRS[direction].opposite] = true;
  };
  for (let level = 0; level < 2; level++) {
    const seen = new Set();
    const start = by(level ? SIZE - 1 : 0, level ? SIZE - 1 : 0, level);
    const stack = [start]; seen.add(start.id);
    while (stack.length) {
      const current = stack[stack.length - 1];
      const options = DIRS.map((_, d) => ({ d, cell: neighbor(current, d) }))
        .filter(({ cell }) => cell && !seen.has(cell.id));
      if (!options.length) { stack.pop(); continue; }
      const choice = options[Math.floor(rng() * options.length)];
      connect(current, choice.cell, choice.d);
      seen.add(choice.cell.id); stack.push(choice.cell);
    }
    // A few loops create uncertain routes while keeping long dead ends.
    for (const c of cells.filter(c => c.level === level)) {
      for (const d of [1, 2]) {
        const n = neighbor(c, d);
        if (n && !c.links[d] && rng() < 0.065) connect(c, n, d);
      }
    }
  }

  function flood(start) {
    const queue = [start], distance = new Map([[start.id, 0]]), previous = new Map();
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (let d = 0; d < 4; d++) {
        if (!c.links[d]) continue;
        const n = neighbor(c, d);
        if (distance.has(n.id)) continue;
        distance.set(n.id, distance.get(c.id) + 1); previous.set(n.id, c.id); queue.push(n);
      }
    }
    return { distance, previous };
  }
  function path(from, to) {
    const { previous } = flood(from);
    const result = [to];
    while (result[0].id !== from.id) result.unshift(cells[previous.get(result[0].id)]);
    return result;
  }
  const spawn = by(0, 0, 0);
  const lowerDistances = flood(spawn).distance;
  const mainLadder = cells.filter(c => c.level === 0 && c.id !== spawn.id)
    .sort((a, b) => lowerDistances.get(b.id) - lowerDistances.get(a.id))[0];
  const upperStart = by(mainLadder.x, mainLadder.z, 1);
  const upperDistances = flood(upperStart).distance;
  const boundary = cells.filter(c => c.level === 1 && (c.x === 0 || c.z === 0 || c.x === SIZE - 1 || c.z === SIZE - 1));
  boundary.sort((a, b) => upperDistances.get(b.id) - upperDistances.get(a.id));
  const exit = boundary[0];
  const exitDir = exit.z === 0 ? 0 : exit.x === SIZE - 1 ? 1 : exit.z === SIZE - 1 ? 2 : 3;

  const ladders = [mainLadder];
  const choices = cells.filter(c => c.level === 0 && c.id !== spawn.id && c.id !== mainLadder.id
    && !(c.x === exit.x && c.z === exit.z)
    && lowerDistances.get(c.id) > 12 && Math.abs(c.x - mainLadder.x) + Math.abs(c.z - mainLadder.z) > 4);
  for (let i = 0; i < 2 && choices.length; i++) {
    const index = Math.floor(rng() * choices.length);
    const selected = choices.splice(index, 1)[0];
    ladders.push(selected);
    for (let j = choices.length - 1; j >= 0; j--)
      if (Math.abs(choices[j].x - selected.x) + Math.abs(choices[j].z - selected.z) < 4) choices.splice(j, 1);
  }
  const ladderIds = new Set(ladders.flatMap(c => [c.id, by(c.x, c.z, 1).id]));
  const key = (a, b) => [a.id, b.id].sort((x, y) => x - y).join('-');
  const barriers = new Map();
  function setOnPath(route, fraction, type) {
    let i = Math.max(0, Math.min(route.length - 2, Math.floor((route.length - 1) * fraction)));
    while (i < route.length - 2 && (ladderIds.has(route[i].id) || ladderIds.has(route[i + 1].id))) i++;
    const a = route[i], b = route[i + 1];
    barriers.set(key(a, b), { a: a.id, b: b.id, type, hits: 0, required: type === 'panel' ? 4 : 0, broken: false });
  }
  const lowerRoute = path(spawn, mainLadder);
  const upperRoute = path(upperStart, exit);
  // A single doorway at either end guarantees two noisy panels on every escape route.
  for (const [cell, keep] of [[spawn, lowerRoute[1]], [exit, upperRoute[upperRoute.length - 2]]]) {
    for (let d = 0; d < 4; d++) {
      if (!cell.links[d]) continue;
      const n = neighbor(cell, d);
      if (n.id === keep.id) continue;
      cell.links[d] = false;
      n.links[DIRS[d].opposite] = false;
    }
  }
  const mandatory = [[spawn, lowerRoute[1]], [upperRoute[upperRoute.length - 2], exit]];
  for (const [a, b] of mandatory)
    barriers.set(key(a, b), { a: a.id, b: b.id, type: 'panel', hits: 0, required: 4, broken: false });
  setOnPath(lowerRoute, 0.38, 'panel');
  setOnPath(lowerRoute, 0.7, 'low');
  setOnPath(upperRoute, 0.43, 'panel');
  setOnPath(upperRoute, 0.72, 'low');
  for (const c of cells) {
    if (rng() > 0.026 || ladderIds.has(c.id) || c.id === spawn.id || c.id === exit.id) continue;
    const options = [1, 2].map(d => neighbor(c, d)).filter(n => n && c.links[DIRS.findIndex(d => d.dx === n.x - c.x && d.dz === n.z - c.z)]);
    if (!options.length) continue;
    const n = options[Math.floor(rng() * options.length)], id = key(c, n);
    if (!barriers.has(id)) barriers.set(id, { a: c.id, b: n.id, type: rng() < 0.58 ? 'panel' : 'low', hits: 0, required: 4, broken: false });
  }
  return { seed, rng, cells, by, neighbor, key, spawn, mainLadder, ladders, ladderIds, exit, exitDir, barriers, lowerRoute, upperRoute };
}

export function center(cell) {
  return { x: (cell.x - (SIZE - 1) / 2) * CELL, z: (cell.z - (SIZE - 1) / 2) * CELL, y: cell.level * LEVEL_HEIGHT };
}

export function cellAt(maze, x, z, level) {
  return maze.by(Math.round(x / CELL + (SIZE - 1) / 2), Math.round(z / CELL + (SIZE - 1) / 2), level);
}

export function adjacent(maze, cell, includeBarriers = false) {
  const result = [];
  for (let d = 0; d < 4; d++) if (cell.links[d]) {
    const next = maze.neighbor(cell, d), barrier = maze.barriers.get(maze.key(cell, next));
    if (includeBarriers || !barrier || barrier.type === 'low' || barrier.broken) result.push(next);
  }
  if (maze.ladderIds.has(cell.id)) result.push(maze.by(cell.x, cell.z, 1 - cell.level));
  return result;
}

export function route(maze, start, goal, includeBarriers = false) {
  if (!start || !goal) return [];
  const queue = [start], prev = new Map([[start.id, null]]);
  for (let i = 0; i < queue.length && !prev.has(goal.id); i++) {
    const c = queue[i];
    for (const n of adjacent(maze, c, includeBarriers)) {
      if (!prev.has(n.id)) { prev.set(n.id, c.id); queue.push(n); }
    }
  }
  if (!prev.has(goal.id)) return [];
  const result = [goal];
  while (result[0].id !== start.id) result.unshift(maze.cells[prev.get(result[0].id)]);
  return result;
}
