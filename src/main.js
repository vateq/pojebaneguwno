import * as THREE from '../vendor/three.bundle.js';
import { createMaze, center, cellAt, creatureRoute, DIRS, CELL, LEVEL_HEIGHT } from './maze.js';
import { createWorld } from './world.js';
import { createCreature } from './creature.js';
import { GameAudio } from './audio.js';
import { handleGameKey } from './input.js';
import { canSeePlayer, updateAttackCharge } from './ai.js';

const canvas = document.querySelector('#game');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#start');
const title = document.querySelector('#title');
const description = document.querySelector('#description');
const controls = document.querySelector('#controls');
const reticle = document.querySelector('#reticle');
const veil = document.querySelector('#veil');
const status = document.querySelector('#status');
const attempt = document.querySelector('#attempt');
if (!canvas.getContext('webgl2')) {
  description.textContent = 'Ta przeglądarka nie udostępnia WebGL 2. Włącz akcelerację sprzętową i otwórz grę ponownie.';
  startButton.disabled = true;
  startButton.textContent = 'WEBGL 2 NIEDOSTĘPNY';
  throw new Error('SZYB 09 requires WebGL 2');
}
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05090a);
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, .035, 78);
camera.rotation.order = 'YXZ'; scene.add(camera);
const flashlight = new THREE.SpotLight(0xd7eee4, 22, 20, .42, .62, 1.5);
flashlight.position.set(.13, -.16, .08);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(512, 512);
flashlight.shadow.camera.near = .15;
flashlight.shadow.camera.far = 19;
flashlight.shadow.bias = -.00022;
const flashlightTarget = new THREE.Object3D(); flashlightTarget.position.set(0, -.02, -1);
camera.add(flashlight, flashlightTarget); flashlight.target = flashlightTarget;
const lightCore = new THREE.PointLight(0xb9d7cd, .13, 2.5); camera.add(lightCore);
const audio = new GameAudio();
let deaths = Number(localStorage.getItem('duct-deaths') || 0);
attempt.textContent = String(deaths + 1).padStart(2, '0');
const maze = createMaze((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
const world = createWorld(scene, maze);
const creature = createCreature(scene);
const startPos = center(maze.spawn);
const player = { x: startPos.x, z: startPos.z, y: 1.39, level: 0, vy: 0, onGround: true,
  yaw: Math.PI, pitch: -.04, crouch: false, light: true, stride: 0, stepClock: 0,
  climb: null, ambushSeen: false, eyeHeight: 1.39 };
camera.position.set(player.x, player.y, player.z);
camera.rotation.set(player.pitch, player.yaw, 0);

const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x323735, roughness: .96 });
const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x191d1d, roughness: 1 });
const legs = [];
for (const side of [-1, 1]) {
  const leg = new THREE.Group(); leg.position.set(side * .18, -1.0, -.12);
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(.105, .13, .48, 8), bodyMaterial);
  thigh.position.set(0, -.15, 0); leg.add(thigh);
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(.078, .098, .42, 8), bodyMaterial);
  shin.position.set(0, -.51, -.07); shin.rotation.x = -.16; leg.add(shin);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(.19, .13, .33), bootMaterial);
  boot.position.set(0, -.76, -.18); leg.add(boot);
  camera.add(leg); legs.push(leg);
}
const torch = new THREE.Group(); torch.position.set(.44, -.38, -.57); torch.rotation.z = -.25;
const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(.065, .053, .32, 9), bootMaterial);
torchBody.rotation.x = Math.PI / 2; torch.add(torchBody);
const torchHead = new THREE.Mesh(new THREE.CylinderGeometry(.094, .068, .065, 12), bodyMaterial);
torchHead.rotation.x = Math.PI / 2; torchHead.position.z = -.18; torch.add(torchHead);
camera.add(torch);

const monster = {
  cell: maze.mainLadder, target: null, investigation: null, alertUntil: 0,
  route: [], nextCell: null, recalc: 0, soundClock: 0, breathClock: 0, eyeTimer: 0, eye: 0,
  verticalTravel: null, voice: null, sightMeter: 0, chaseUntil: 0,
  attackCharge: 0, warned: false,
};
const monsterStart = center(monster.cell);
creature.group.position.set(monsterStart.x, monsterStart.y, monsterStart.z);
creature.group.rotation.y = Math.PI * .6;

const keys = new Set();
let mode = 'menu', time = 0, previousTime = performance.now(), deathTime = 0;
let fanLoops = [], flashPulse = 0, headBob = 0, lastNoise = 0, deathSoundPlayed = false;
const tmpDirection = new THREE.Vector3();

function showOverlay(headline, message, buttonText, showControls = false) {
  overlay.hidden = false; title.textContent = headline; description.textContent = message;
  startButton.textContent = buttonText; controls.hidden = !showControls;
  reticle.hidden = true;
}
function hideOverlay() { overlay.hidden = true; reticle.hidden = false; }
function floorY(level) { return level * LEVEL_HEIGHT; }
function currentCell() { return cellAt(maze, player.x, player.z, player.level); }
function noise(position, strength) {
  lastNoise = time;
  const distance = creature.group.position.distanceTo(position);
  if (distance > strength) return;
  monster.investigation = cellAt(maze, position.x, position.z, player.level);
  monster.alertUntil = Math.max(monster.alertUntil, time + 8 + strength * .12);
  monster.recalc = 0;
  if (strength > 16 && distance < 28) {
    audio.play('metal-squeak', creature.group.position, { gain: .15, duration: .9, offset: 0, rate: .8 });
  }
}
function barrierOn(a, b) { return maze.barriers.get(maze.key(a, b)); }
function openBetween(a, b, crouched = false, sight = false) {
  if (!a || !b || a.level !== b.level) return false;
  const d = DIRS.findIndex(v => v.dx === b.x - a.x && v.dz === b.z - a.z);
  if (d < 0 || !a.links[d]) return false;
  const barrier = barrierOn(a, b);
  return !barrier || barrier.broken || (barrier.type === 'low' && (sight ? false : crouched));
}
function validPosition(x, z, level, crouched) {
  const c = cellAt(maze, x, z, level), radius = .25;
  if (!c) {
    if (level !== 1) return false;
    const exit = center(maze.exit), d = DIRS[maze.exitDir];
    const forward = (x - exit.x) * d.dx + (z - exit.z) * d.dz;
    const lateral = Math.abs((x - exit.x) * d.dz - (z - exit.z) * d.dx);
    return forward >= CELL / 2 && forward < 6.5 && lateral < 1.4;
  }
  const p = center(c), dx = x - p.x, dz = z - p.z;
  for (let d = 0; d < 4; d++) {
    const projection = dx * DIRS[d].dx + dz * DIRS[d].dz;
    if (projection <= CELL / 2 - radius) continue;
    const next = maze.neighbor(c, d);
    if (!next) {
      if (c.id === maze.exit.id && d === maze.exitDir) continue;
      return false;
    }
    if (!openBetween(c, next, crouched)) return false;
  }
  return true;
}
function lineClear(x1, z1, x2, z2, level) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  let prev = cellAt(maze, x1, z1, level);
  for (let i = 1, steps = Math.ceil(len / .18); i <= steps; i++) {
    const t = i / steps;
    const c = cellAt(maze, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, level);
    if (!c) return false;
    if (c.id !== prev.id && !openBetween(prev, c, false, true)) return false;
    prev = c;
  }
  return true;
}
function tryBreak() {
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersections = ray.intersectObjects(world.panelTargets, false);
  const hit = intersections.find(h => h.distance < 3.25 && h.object.parent.visible);
  if (!hit) return;
  const panel = hit.object.userData.barrier;
  panel.hits++;
  const p = hit.point.clone();
  flashPulse = .17;
  audio.play(panel.hits % 2 ? 'metal-impact' : 'metal-groan', p,
    { gain: .33, rate: .75 + Math.random() * .28, duration: .45 + Math.random() * .2, offset: panel.hits % 2 ? 1.2 : .5 });
  if (panel.hits % 2) audio.play('metal-squeak', p, { gain: .16, duration: .65, offset: .45 });
  noise(p, 28);
  if (panel.hits >= panel.required) {
    panel.broken = true; panel.group.visible = false;
    audio.play('metal-impact', p, { gain: .65, duration: 1.2, offset: 2.4, rate: .73 });
    noise(p, 38);
  }
}

function nearbyLadder() {
  const c = currentCell();
  return c && maze.ladderIds.has(c.id) && Math.hypot(player.x - center(c).x - .72, player.z - center(c).z) < 1.22 ? c : null;
}
function beginClimb() {
  if (mode !== 'playing' || player.climb || !player.onGround) return;
  const cell = nearbyLadder(); if (!cell) return;
  player.climb = { cell, from: player.level, to: 1 - player.level, progress: 0,
    ambush: !player.ambushSeen && player.level === 0 && cell.x === maze.mainLadder.x && cell.z === maze.mainLadder.z,
    danger: 0, quiet: 0, escaped: false };
  player.x = center(cell).x + .72; player.z = center(cell).z;
  player.vy = 0;
  audio.play('ladder-metal', new THREE.Vector3(player.x, player.y, player.z), { gain: .38, duration: .8, offset: 2.1 });
  noise(camera.position.clone(), 8);
}
function updateClimb(dt) {
  const climb = player.climb;
  if (!climb) return false;
  if (climb.ambush && !climb.escaped && climb.progress > .39) {
    climb.danger += dt;
    const anchor = center(climb.cell);
    creature.setLimb(new THREE.Vector3(anchor.x + .2, floorY(1) + 1.9, anchor.z - .25), Math.min(.79, .18 + climb.danger * .4));
    if (climb.danger < .09) audio.play('jump-rise', new THREE.Vector3(anchor.x, floorY(1), anchor.z),
      { gain: .24, duration: 2.8, lowpass: 1450 });
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) climb.quiet += dt;
    else climb.quiet = Math.max(0, climb.quiet - dt * 1.7);
    if (player.light) climb.quiet = Math.max(0, climb.quiet - dt * 2.2);
    if (climb.quiet > 2.05) {
      climb.escaped = true; player.ambushSeen = true; creature.setLimb(new THREE.Vector3(), 0);
      audio.play('metal-groan', new THREE.Vector3(anchor.x, floorY(1), anchor.z), { gain: .27, duration: 1.4, offset: 2.3 });
    } else if (climb.danger > 3.35) { kill('ladder'); return true; }
  }
  if ((!climb.ambush || climb.escaped || climb.progress < .39) && keys.has('KeyW'))
    climb.progress = Math.min(1, climb.progress + dt * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? .15 : .24));
  if (keys.has('KeyS')) climb.progress = Math.max(0, climb.progress - dt * .2);
  const eased = climb.progress;
  player.y = floorY(climb.from) + (floorY(climb.to) - floorY(climb.from)) * eased + .99;
  player.eyeHeight = .99;
  camera.position.set(player.x, player.y, player.z);
  if (Math.random() < dt * 1.8 && (keys.has('KeyW') || keys.has('KeyS'))) {
    audio.play('ladder-metal', camera.position, { gain: .24, duration: .28, offset: 1 + Math.random() * 6 });
    noise(camera.position.clone(), keys.has('ShiftLeft') ? 2.5 : 8);
  }
  if (climb.progress >= 1 || (climb.progress <= 0 && keys.has('KeyS'))) {
    player.level = climb.progress >= 1 ? climb.to : climb.from;
    player.climb = null; player.y = floorY(player.level) + .99;
    creature.setLimb(new THREE.Vector3(), 0);
  }
  return true;
}

function updatePlayer(dt) {
  player.crouch = keys.has('KeyC') || !validPosition(player.x, player.z, player.level, false);
  player.eyeHeight = THREE.MathUtils.damp(player.eyeHeight, player.crouch ? .82 : 1.39, 12, dt);
  if (updateClimb(dt)) return;
  let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  let strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const moving = forward !== 0 || strafe !== 0;
  const quiet = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = player.crouch ? 1.13 : quiet ? 1.38 : 2.85;
  if (moving) {
    const normalize = 1 / Math.hypot(forward, strafe); forward *= normalize; strafe *= normalize;
    const dx = (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) * speed * dt;
    const dz = (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) * speed * dt;
    if (validPosition(player.x + dx, player.z, player.level, player.crouch)) player.x += dx;
    if (validPosition(player.x, player.z + dz, player.level, player.crouch)) player.z += dz;
    player.stride += speed * dt;
    if (player.stride > (quiet || player.crouch ? .85 : .74) && player.onGround) {
      player.stride = 0;
      const clip = quiet || player.crouch ? 'steps-soft' : 'steps-metal';
      audio.play(clip, camera.position, { gain: quiet || player.crouch ? .16 : .34, duration: .31,
        offset: Math.random() * (clip === 'steps-soft' ? 15 : 3.2), rate: .9 + Math.random() * .22 });
      noise(camera.position.clone(), quiet || player.crouch ? 2.3 : 9.3);
    }
  }
  if (!player.onGround) {
    player.vy -= 10.8 * dt;
    player.y += player.vy * dt;
    const floor = floorY(player.level) + player.eyeHeight;
    if (player.y <= floor) {
      player.y = floor; player.vy = 0; player.onGround = true;
      audio.play('steps-heavy', camera.position, { gain: .48, duration: .43, offset: 11.3 });
      noise(camera.position.clone(), 22);
      flashPulse = .09;
    }
  } else player.y = THREE.MathUtils.damp(player.y, floorY(player.level) + player.eyeHeight, 13, dt);
  headBob = THREE.MathUtils.damp(headBob, moving && player.onGround ? Math.sin(time * (quiet ? 6 : 11)) * (quiet ? .007 : .025) : 0, 9, dt);
  camera.position.set(player.x, player.y + headBob, player.z);
  legs.forEach((leg, i) => {
    leg.rotation.x = moving ? Math.sin(time * (quiet ? 5 : 9) + i * Math.PI) * .26 : 0;
    leg.position.y = -1.0 + (player.crouch ? .25 : 0);
  });
  torch.rotation.x = moving ? Math.sin(time * 8) * .035 : 0;
  if (player.level === 1) {
    const e = center(maze.exit), d = DIRS[maze.exitDir];
    if ((player.x - e.x) * d.dx + (player.z - e.z) * d.dz > CELL / 2 + 3.5 &&
      Math.abs((player.x - e.x) * d.dz - (player.z - e.z) * d.dx) < 1.4) win();
  }
}

function choosePatrolCell() {
  const from = monster.cell;
  for (let i = 0; i < 28; i++) {
    const c = maze.cells[Math.floor(Math.random() * maze.cells.length)];
    if (c.level !== from.level || c.id === from.id) continue;
    const path = creatureRoute(maze, from, c);
    if (path.length > 3 && path.at(-1).id === c.id) return c;
  }
  return from;
}
function updateMonster(dt) {
  const m = creature.group;
  const playerCell = currentCell();
  const mCell = monster.cell;
  const sameLevel = monster.cell.level === player.level;
  const horizontal = Math.hypot(player.x - m.position.x, player.z - m.position.z);
  const distance = sameLevel ? horizontal : Math.hypot(horizontal, LEVEL_HEIGHT);
  const clear = sameLevel && horizontal < 20 && lineClear(m.position.x, m.position.z, player.x, player.z, player.level);
  const toPlayer = new THREE.Vector3(player.x - m.position.x, 0, player.z - m.position.z).normalize();
  const facing = new THREE.Vector3(-Math.sin(m.rotation.y), 0, -Math.cos(m.rotation.y));
  const dot = facing.dot(toPlayer);
  const quiet = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const moving = keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD');
  const visible = canSeePlayer({ distance, dot, clear, light: player.light,
    quiet, crouch: player.crouch, moving });
  if (clear && dot < -.48 && distance < 3.35) monster.eyeTimer += dt;
  else monster.eyeTimer = Math.max(0, monster.eyeTimer - dt * 1.1);
  monster.eye = THREE.MathUtils.clamp((monster.eyeTimer - 2.5) / 1.1, 0, 1);
  const rearSeen = clear && dot < -.48 && monster.eye > .98;
  monster.sightMeter = THREE.MathUtils.clamp(monster.sightMeter +
    (visible || rearSeen ? dt * (player.light ? 1.15 : .72) : -dt * 1.35), 0, 1);
  if (monster.sightMeter > .48 && !monster.warned) {
    audio.play('breath-close', m.position, { gain: .36, rate: .72, duration: 1.5, offset: 1.3 });
    monster.warned = true;
  }
  if (monster.sightMeter < .12) monster.warned = false;
  if (monster.sightMeter >= 1) {
    if (monster.investigation?.id !== playerCell?.id) monster.recalc = 0;
    monster.investigation = playerCell;
    monster.alertUntil = time + 6.5;
    monster.chaseUntil = time + 3.6;
  }
  // A close encounter gives a short chance to pull away or break line of sight.
  monster.attackCharge = updateAttackCharge(monster.attackCharge, clear && distance < .87, dt);
  if (monster.attackCharge >= 1) { kill('contact'); return; }

  if (time > monster.alertUntil) monster.investigation = null;
  if (!monster.target || (monster.investigation && monster.target.id !== monster.investigation.id) ||
      (!monster.investigation && monster.target.id === monster.cell.id)) {
    monster.target = monster.investigation || choosePatrolCell(); monster.recalc = 0;
  }
  monster.recalc -= dt;
  if (monster.recalc <= 0 || monster.route.length < 2) {
    monster.route = creatureRoute(maze, mCell, monster.target);
    monster.recalc = monster.investigation ? .38 : 2.3;
  }
  // Finish the current corridor before turning; a mid-cell route change could
  // otherwise cut diagonally through a wall or a sealed panel.
  const next = monster.nextCell || monster.route[1];
  if (!next) monster.target = null;
  if (next && next.level !== monster.cell.level) {
    const ladder = center(monster.cell);
    const near = Math.hypot(m.position.x - ladder.x, m.position.z - ladder.z);
    if (near < .24) {
      monster.nextCell = next;
      monster.verticalTravel ??= 0;
      monster.verticalTravel += dt;
      m.position.y = floorY(monster.cell.level) + (floorY(next.level) - floorY(monster.cell.level)) * Math.min(1, monster.verticalTravel / 2.4);
      if (monster.verticalTravel >= 2.4) {
        monster.cell = next; monster.nextCell = null;
        monster.verticalTravel = null; m.position.y = floorY(next.level);
        monster.recalc = 0;
      }
      creature.update(time, .2, monster.eye); return;
    }
  }
  const chasing = time < monster.chaseUntil;
  const investigating = monster.investigation !== null;
  const speed = chasing ? 2.17 : investigating ? 1.42 : .77;
  let length = 0;
  if (next) {
    const edge = next.level === monster.cell.level ? barrierOn(monster.cell, next) : null;
    if (edge && (edge.type === 'low' || !edge.broken && edge.type === 'panel')) {
      monster.route = []; monster.recalc = 0;
    } else {
      const target = next.level === monster.cell.level ? center(next) : center(monster.cell);
      const dx = target.x - m.position.x, dz = target.z - m.position.z;
      length = Math.hypot(dx, dz);
      if (length > .08) {
        monster.nextCell = next;
        const step = Math.min(length, speed * dt);
        m.position.x += dx / length * step; m.position.z += dz / length * step;
        const desired = Math.atan2(-dx, -dz);
        m.rotation.y += Math.atan2(Math.sin(desired - m.rotation.y), Math.cos(desired - m.rotation.y)) * Math.min(1, dt * 3.7);
      } else if (next.level === monster.cell.level) {
        monster.cell = next; monster.nextCell = null; monster.recalc = 0;
      }
    }
  }
  m.position.y = floorY(monster.cell.level) + Math.sin(time * (chasing ? 9 : 3.2)) * .025;
  creature.update(time, length > .08 ? chasing ? 1.4 : .55 : .08, monster.eye, monster.attackCharge * .25);
  monster.soundClock -= dt;
  if (monster.soundClock <= 0 && length > .1) {
    audio.play(chasing ? 'run-metal' : 'steps-heavy', m.position,
      { gain: chasing ? .48 : investigating ? .25 : .13, duration: chasing ? .34 : .31,
        offset: Math.random() * (chasing ? 14 : 19), rate: chasing ? .92 : .66, lowpass: chasing ? 3000 : 1350 });
    monster.soundClock = chasing ? .46 : investigating ? .68 : 1.15;
    if (chasing && Math.random() < .14) audio.play('metal-groan', m.position, { gain: .18, duration: .38, offset: Math.random() * 4 });
  }
  monster.breathClock -= dt;
  if (monster.breathClock <= 0) {
    audio.play(chasing ? 'breath-close' : 'breath-low', m.position,
      { gain: chasing ? .33 : .11, duration: chasing ? 2.1 : 2.8,
        rate: chasing ? .86 : .73, lowpass: chasing ? 2100 : 750, offset: Math.random() * 2 });
    monster.breathClock = chasing ? 4.4 : 7 + Math.random() * 3;
  }
  monster.voice?.setPosition(m.position);
  monster.voice?.setGain(chasing ? .17 : investigating ? .075 : .028);
}

function kill(reason) {
  if (mode !== 'playing') return;
  mode = 'dying'; deathTime = 0; deathSoundPlayed = false;
  document.exitPointerLock?.();
  audio.play('breath-close', creature.group.position,
    { gain: .38, duration: 2.4, rate: .68, lowpass: 1600 });
  audio.play('metal-groan', creature.group.position,
    { gain: .15, duration: 1.4, rate: .7, lowpass: 1200 });
  if (reason === 'ladder') creature.setLimb(new THREE.Vector3(), 0);
  status.textContent = '';
}
function win() {
  if (mode !== 'playing') return;
  mode = 'won'; document.exitPointerLock?.();
  audio.stopAll();
  veil.style.opacity = '0';
  showOverlay('WYJŚCIE', 'Powietrze. Cisza. Udało ci się wydostać.', 'ZAGRAJ PONOWNIE');
  startButton.onclick = () => location.reload();
}
function updateDeath(dt) {
  deathTime += dt;
  const k = Math.min(1, deathTime / 3.6);
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
  const destination = camera.position.clone().addScaledVector(forward, 1.35 - k * 1.05);
  // The mouth begins at the player's legs, then advances over the camera.
  destination.y -= 1.5 - k * 1.25;
  creature.group.position.lerp(destination, Math.min(1, dt * (2 + deathTime * 1.6)));
  creature.group.rotation.y = Math.atan2(camera.position.x - creature.group.position.x,
    camera.position.z - creature.group.position.z) + Math.PI;
  creature.update(time, 1.2, 1, k);
  camera.rotation.x = THREE.MathUtils.lerp(player.pitch, deathTime < 2.5 ? -.72 : -.12, Math.min(1, deathTime * .75));
  camera.rotation.z = Math.sin(deathTime * 12) * (.01 + k * .055);
  legs.forEach((leg, i) => {
    leg.position.z = -.12 - k * .24;
    leg.rotation.x = Math.sin(deathTime * 15 + i * Math.PI) * (.18 + k * .3);
  });
  veil.style.opacity = String(Math.max(0, (deathTime - 2.2) / 2.4));
  if (!deathSoundPlayed && deathTime > 1.45) {
    audio.play('jump-hit', null, { gain: .42, duration: 2.3, lowpass: 1800 });
    audio.play('jump-rise', null, { gain: .21, duration: 2, offset: 1.1, lowpass: 1100 });
    deathSoundPlayed = true;
  }
  if (deathTime > 4.6) {
    mode = 'dead'; deaths++;
    localStorage.setItem('duct-deaths', String(deaths));
    showOverlay('GAME OVER', `PRÓBA ${String(deaths).padStart(2, '0')}`, 'SPRÓBUJ PONOWNIE');
    controls.hidden = true;
    startButton.onclick = () => location.reload();
  }
}

function update(dt) {
  time += dt;
  if (mode === 'playing') { updatePlayer(dt); updateMonster(dt); }
  else if (mode === 'dying') updateDeath(dt);
  else if (mode === 'menu' || mode === 'paused') creature.update(time, .25, 0);
  world.fans.forEach(f => { f.rotor.rotation.y += dt * 6; });
  flashlight.intensity = player.light ? 22 + Math.sin(time * 27) * .17 + flashPulse * 4 : 0;
  lightCore.intensity = player.light ? .13 : 0;
  flashPulse = Math.max(0, flashPulse - dt);
  if (audio.context) {
    camera.getWorldDirection(tmpDirection); audio.listener(camera.position, tmpDirection);
    fanLoops.forEach(({ sound }) => { /* fixed positional loops */ void sound; });
  }
  renderer.render(scene, camera);
}
function animate(now) {
  const dt = Math.min((now - previousTime) / 1000, .05); previousTime = now;
  update(dt); requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

async function begin() {
  if (mode === 'dead' || mode === 'won') return location.reload();
  startButton.disabled = true; startButton.textContent = 'ŁADOWANIE DŹWIĘKU…';
  await audio.init();
  if (!fanLoops.length) {
    fanLoops = world.fans.map(f => ({ sound: audio.play('fan', f.position,
      { gain: .085, loop: true, ref: 1.3, lowpass: 900 }), position: f.position }));
    monster.voice = audio.play('breath-low', creature.group.position,
      { gain: .028, rate: .72, loop: true, ref: 1.7, lowpass: 720 });
  }
  mode = 'playing'; startButton.disabled = false;
  canvas.requestPointerLock();
}
startButton.addEventListener('click', begin);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas && mode === 'playing') {
    hideOverlay(); status.textContent = '';
  } else if (mode === 'playing') {
    keys.clear();
    mode = 'paused'; showOverlay('WSTRZYMANO', '', 'WRÓĆ');
  }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || mode !== 'playing') return;
  player.yaw -= e.movementX * .0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * .0022, -1.43, 1.43);
  camera.rotation.set(player.pitch, player.yaw, 0);
});
document.addEventListener('keydown', e => {
  const active = mode === 'playing' && document.pointerLockElement === canvas;
  if (!handleGameKey(e, active, keys, true) || e.repeat) return;
  if (e.code === 'KeyF') {
    player.light = !player.light;
    audio.play('metal-squeak', camera.position, { gain: .06, duration: .08, offset: 1.8 });
  }
  if (e.code === 'KeyE') beginClimb();
  if (e.code === 'Space' && player.onGround && !player.crouch && !keys.has('KeyC') && !player.climb) {
    player.vy = 3.8; player.onGround = false;
    audio.play('steps-metal', camera.position, { gain: .31, duration: .27, offset: 1.5 });
    noise(camera.position.clone(), 11);
  }
});
document.addEventListener('keyup', e => {
  handleGameKey(e, mode === 'playing' && document.pointerLockElement === canvas, keys, false);
  keys.delete(e.code);
});
document.addEventListener('mousedown', e => {
  if (mode === 'playing' && document.pointerLockElement === canvas && e.button === 0) tryBreak();
});
window.addEventListener('blur', () => keys.clear());
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
});
