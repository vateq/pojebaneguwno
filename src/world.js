import * as THREE from '../vendor/three.bundle.js';
import { CELL, LEVEL_HEIGHT, SIZE, DIRS, center, random } from './maze.js';

function metalTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#777b78'; ctx.fillRect(0, 0, 256, 256);
  const rng = random(1187);
  for (let i = 0; i < 17000; i++) {
    const v = Math.floor(38 + rng() * 82), a = .025 + rng() * .17;
    ctx.fillStyle = `rgba(${v},${v + 2},${v},${a})`;
    ctx.fillRect(rng() * 256, rng() * 256, .5 + rng() * 26, .5 + rng() * 1.2);
  }
  for (let y = 18; y < 256; y += 56) {
    ctx.fillStyle = 'rgba(15,19,19,.15)'; ctx.fillRect(0, y, 256, 3);
    ctx.fillStyle = 'rgba(215,218,208,.08)'; ctx.fillRect(0, y + 3, 256, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
function staticBoxes(scene, pieces, material) {
  if (!pieces.length) return;
  const mesh = new THREE.InstancedMesh(unitBox, material, pieces.length);
  const dummy = new THREE.Object3D();
  pieces.forEach((p, i) => {
    dummy.position.set(p[0], p[1], p[2]); dummy.scale.set(p[3], p[4], p[5]);
    dummy.rotation.y = p[6] || 0; dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true;
  scene.add(mesh);
}

function bone(group, material, a, b, radius) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .78, radius, d.length(), 7), material);
  mesh.position.copy(from.add(to).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  group.add(mesh); return mesh;
}

function addCorpse(scene, x, y, z, angle, rng) {
  const group = new THREE.Group(); group.position.set(x, y + .11, z); group.rotation.y = angle;
  const cloth = new THREE.MeshStandardMaterial({ color: 0x444944, roughness: .98 });
  const skin = new THREE.MeshStandardMaterial({ color: 0x786a62, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x291919, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.28, 7, 6), cloth);
  torso.scale.set(1, .55, 1.8); torso.position.set(0, .1, 0); group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 7), skin);
  head.position.set(.08, .1, -.59); group.add(head);
  bone(group, cloth, [-.18, .08, .3], [-.35, .05, .82], .085);
  bone(group, cloth, [.18, .08, .3], [.31, .07, .6], .082);
  bone(group, skin, [-.26, .07, -.2], [-.58, .03, -.48], .063);
  if (rng() > .4) bone(group, skin, [.25, .07, -.12], [.55, .02, -.35], .055);
  const stain = new THREE.Mesh(new THREE.CircleGeometry(.44, 13), dark);
  stain.rotation.x = -Math.PI / 2; stain.scale.set(1.3, .75, 1);
  stain.position.set(.12, -.087, -.2); group.add(stain);
  scene.add(group);
}

export function createWorld(scene, maze) {
  const rng = random(maze.seed + 989);
  const metal = new THREE.MeshStandardMaterial({ color: 0x87908d, map: metalTexture(), metalness: .55, roughness: .77, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0x343c3b, metalness: .78, roughness: .48 });
  const black = new THREE.MeshStandardMaterial({ color: 0x131b1c, metalness: .35, roughness: .9 });
  const grime = new THREE.MeshStandardMaterial({ color: 0x222820, roughness: 1, transparent: true, opacity: .82, side: THREE.DoubleSide });
  const red = new THREE.MeshStandardMaterial({ color: 0x422623, roughness: .98, side: THREE.DoubleSide });
  const allMetal = [], allTrim = [], allDark = [];
  const add = (list, x, y, z, w, h, d, rotation = 0) => list.push([x, y, z, w, h, d, rotation]);
  const isLadder = (c) => maze.ladderIds.has(c.id);
  const panelTargets = [];
  const fanLocations = [];

  for (const cell of maze.cells) {
    const { x, y, z } = center(cell), ladder = isLadder(cell);
    if (ladder) {
      // Four strips leave a readable square hatch above and below the ladder.
      for (const [dx, dz, w, d] of [[-1.35, 0, 1.1, CELL], [1.35, 0, 1.1, CELL], [0, -1.35, 1.6, 1.1], [0, 1.35, 1.6, 1.1]]) {
        add(allMetal, x + dx, y - .09, z + dz, w, .18, d);
        add(allMetal, x + dx, y + 2.43, z + dz, w, .16, d);
      }
    } else {
      add(allMetal, x, y - .09, z, CELL, .18, CELL);
      add(allMetal, x, y + 2.43, z, CELL, .16, CELL);
    }
    // Ribbed seams, pipes, grate slits, and riveted brackets.
    for (const side of [-1, 1]) {
      add(allTrim, x + side * (CELL / 2 - .13), y + .15, z, .055, .24, CELL);
      add(allTrim, x + side * (CELL / 2 - .13), y + 2.2, z, .07, .05, CELL);
    }
    for (const offset of [-1.2, 0, 1.2]) {
      if (ladder && Math.abs(offset) < .2) continue;
      add(allTrim, x + offset, y + .009, z, .06, .025, CELL - .16);
    }
    if (rng() < .33 && !ladder) {
      add(allDark, x + (rng() - .5) * 2.6, y + .003, z + (rng() - .5) * 2.6, .45 + rng() * .9, .012, .16 + rng() * .38, rng() * 3);
    }
    for (let d = 0; d < 4; d++) {
      const n = maze.neighbor(cell, d);
      if (cell.links[d] || (cell.id === maze.exit.id && d === maze.exitDir)) continue;
      if (n && cell.id > n.id) continue;
      const alongX = d % 2 === 0;
      const wx = x + DIRS[d].dx * CELL / 2, wz = z + DIRS[d].dz * CELL / 2;
      add(allMetal, wx, y + 1.16, wz, alongX ? CELL : .16, 2.43, alongX ? .16 : CELL);
      add(allTrim, wx, y + .2, wz, alongX ? CELL : .22, .07, alongX ? .22 : CELL);
      if (rng() < .18) {
        const smudge = new THREE.Mesh(new THREE.PlaneGeometry(.36 + rng() * .8, .14 + rng() * .5), grime);
        smudge.position.set(wx - DIRS[d].dx * .09, y + .45 + rng() * 1.2, wz - DIRS[d].dz * .09);
        smudge.rotation.y = d * Math.PI / 2;
        scene.add(smudge);
      }
    }
    if (rng() < .028 && cell.id !== maze.spawn.id && cell.id !== maze.exit.id && !ladder)
      addCorpse(scene, x + (rng() - .5), y, z + (rng() - .5), rng() * Math.PI * 2, rng);
    if (rng() < .016 && !ladder) fanLocations.push(new THREE.Vector3(x, y + 2.15, z));
  }
  staticBoxes(scene, allMetal, metal);
  staticBoxes(scene, allTrim, trim);
  staticBoxes(scene, allDark, black);

  for (const ladderCell of maze.ladders) {
    const { x, z } = center(ladderCell);
    for (let i = 0; i < 19; i++) add(allTrim, x + .72, .27 + i * .27, z, .75, .048, .065);
    add(allTrim, x + .36, 2.55, z - .36, .07, 5.35, .07);
    add(allTrim, x + 1.08, 2.55, z - .36, .07, 5.35, .07);
    // A shaft connecting the ceiling aperture to the next floor.
    add(allDark, x, 2.92, z - .83, 1.72, 1.13, .09);
    add(allDark, x, 2.92, z + .83, 1.72, 1.13, .09);
  }
  // Geometry added after initial batches belongs to separate instanced meshes.
  staticBoxes(scene, allTrim.slice(allTrim.length - maze.ladders.length * 21), trim);
  staticBoxes(scene, allDark.slice(allDark.length - maze.ladders.length * 2), black);

  for (const barrier of maze.barriers.values()) {
    const a = maze.cells[barrier.a], b = maze.cells[barrier.b];
    const ca = center(a), cb = center(b);
    const x = (ca.x + cb.x) / 2, z = (ca.z + cb.z) / 2, y = ca.y;
    const alongX = a.z !== b.z;
    const group = new THREE.Group(); group.position.set(x, y, z);
    if (barrier.type === 'panel') {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 3.35 : .13, 2.25, alongX ? .13 : 3.35), metal);
      plate.position.y = 1.2; plate.userData.barrier = barrier;
      group.add(plate); panelTargets.push(plate);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 3.35 : .2, .085, alongX ? .2 : 3.35), trim);
      bar.position.y = 1.1; group.add(bar);
      for (let i = -1; i <= 1; i += 2) {
        const screw = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 4), black);
        screw.position.set(alongX ? i * 1.42 : .11, 2.05, alongX ? .11 : i * 1.42);
        group.add(screw);
      }
    } else {
      const low = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 3.4 : .24, 1.2, alongX ? .24 : 3.4), metal);
      low.position.y = 1.82; group.add(low);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 3.45 : .3, .07, alongX ? .3 : 3.45), trim);
      lip.position.y = 1.22; group.add(lip);
    }
    scene.add(group); barrier.group = group;
  }

  const exitAt = center(maze.exit), dir = DIRS[maze.exitDir];
  const exitGroup = new THREE.Group();
  const midpoint = new THREE.Vector3(exitAt.x + dir.dx * 3.3, exitAt.y, exitAt.z + dir.dz * 3.3);
  exitGroup.position.copy(midpoint);
  exitGroup.rotation.y = Math.atan2(dir.dx, dir.dz);
  function exitBox(w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); exitGroup.add(mesh);
  }
  exitBox(3.6, .2, 5.5, 0, -.08, 0, metal);
  exitBox(3.6, .2, 5.5, 0, 2.43, 0, metal);
  for (const side of [-1, 1]) exitBox(.14, 2.43, 5.5, side * 1.8, 1.2, 0, metal);
  exitBox(3.25, 2.2, .07, 0, 1.2, 2.78,
    new THREE.MeshBasicMaterial({ color: 0xbad4c5, toneMapped: false }));
  const exitLight = new THREE.PointLight(0xaee9d4, 4, 13); exitLight.position.set(0, 1.3, 1.7); exitGroup.add(exitLight);
  scene.add(exitGroup);

  const fans = fanLocations.slice(0, 7).map(p => {
    const group = new THREE.Group(); group.position.copy(p);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .07, 16), black);
    group.add(disc);
    const rotor = new THREE.Group(); rotor.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.16, .03, .39), trim);
      blade.position.z = .2; blade.rotation.y = .42; const pivot = new THREE.Group();
      pivot.rotation.y = i * Math.PI / 2; pivot.add(blade); rotor.add(pivot);
    }
    group.add(rotor); scene.add(group); return { position: p, rotor };
  });
  const ambient = new THREE.HemisphereLight(0x344745, 0x080b0b, .18); scene.add(ambient);
  scene.fog = new THREE.FogExp2(0x060a0b, .07);
  for (let i = 0; i < 12; i++) {
    const c = maze.cells[Math.floor(rng() * maze.cells.length)];
    const p = center(c), light = new THREE.PointLight(i % 4 ? 0x849b91 : 0x9b5b48, .32, 6.5, 2);
    light.position.set(p.x, p.y + 2.12, p.z); scene.add(light);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(.67, .026, .12),
      new THREE.MeshBasicMaterial({ color: i % 4 ? 0x566d65 : 0x563326 }));
    tube.position.copy(light.position); scene.add(tube);
  }
  return { panelTargets, fans, exitLight };
}
