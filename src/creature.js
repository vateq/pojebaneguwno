import * as THREE from '../vendor/three.bundle.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function skinMaps() {
  const color = document.createElement('canvas'), height = document.createElement('canvas');
  color.width = color.height = height.width = height.height = 512;
  const c = color.getContext('2d'), b = height.getContext('2d');
  c.fillStyle = '#bca498'; c.fillRect(0, 0, 512, 512);
  b.fillStyle = '#777'; b.fillRect(0, 0, 512, 512);
  let seed = 0x9e18b31;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 18000; i++) {
    const x = rng() * 512, y = rng() * 512, w = 1 + rng() * 17;
    c.fillStyle = rng() < .52 ? `rgba(67,28,32,${.035 + rng() * .15})` :
      `rgba(247,214,193,${.025 + rng() * .15})`;
    c.fillRect(x, y, w, .5 + rng() * 4);
    const shade = Math.floor(80 + rng() * 100);
    b.fillStyle = `rgba(${shade},${shade},${shade},.24)`;
    b.fillRect(x, y, w, 1 + rng() * 3);
  }
  for (let i = 0; i < 180; i++) {
    const x = rng() * 512, y = rng() * 512;
    c.strokeStyle = rng() < .5 ? 'rgba(80,24,30,.28)' : 'rgba(255,220,197,.3)';
    c.lineWidth = .5 + rng() * 2;
    c.beginPath(); c.moveTo(x, y);
    c.bezierCurveTo(x + 7, y + 4, x + 17, y - 5, x + 23 + rng() * 20, y + 7);
    c.stroke();
  }
  const map = new THREE.CanvasTexture(color), bumpMap = new THREE.CanvasTexture(height);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return { map, bumpMap };
}

// A single tapered surface follows the whole limb; joints are bends in skin,
// rather than cylinders joined by visible balls.
function makeTube(parent, material, initial, radii, axial = 22, sides = 9) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((axial + 1) * (sides + 1) * 3);
  const uv = [], indices = [];
  for (let j = 0; j <= axial; j++) for (let i = 0; i <= sides; i++) {
    uv.push(i / sides, j / axial * 2);
    if (j < axial && i < sides) {
      const a = j * (sides + 1) + i, next = a + sides + 1;
      indices.push(a, next, a + 1, a + 1, next, next + 1);
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true; parent.add(mesh);
  function deform(points) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    for (let j = 0; j <= axial; j++) {
      const t = j / axial, p = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
      const axis = Math.abs(tangent.z) > .94 ? V(1, 0, 0) : V(0, 0, 1);
      const right = new THREE.Vector3().crossVectors(tangent, axis).normalize();
      const up = new THREE.Vector3().crossVectors(tangent, right).normalize();
      const k = Math.min(radii.length - 2, Math.floor(t * (radii.length - 1)));
      const radius = THREE.MathUtils.lerp(radii[k], radii[k + 1], t * (radii.length - 1) - k);
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2, variation = 1 + .05 * Math.sin(j * 1.7 + i * 1.9);
        p.clone().addScaledVector(right, Math.cos(a) * radius * variation)
          .addScaledVector(up, Math.sin(a) * radius * variation)
          .toArray(positions, (j * (sides + 1) + i) * 3);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  }
  deform(initial);
  return { mesh, deform };
}

function torsoGeometry() {
  const profiles = [
    [-1.73, .25, .29, 1.5], [-1.53, .32, .33, 1.5], [-1.28, .23, .27, 1.47],
    [-1.02, .31, .29, 1.45], [-.72, .44, .34, 1.44], [-.38, .52, .36, 1.43],
    [-.08, .49, .36, 1.43], [.25, .45, .33, 1.43], [.57, .43, .35, 1.43],
    [.91, .40, .37, 1.46], [1.18, .32, .27, 1.48], [1.43, .045, .07, 1.5],
  ];
  const rows = 72, sides = 32, positions = [], uv = [], indices = [];
  for (let j = 0; j <= rows; j++) {
    const f = j / rows * (profiles.length - 1), k = Math.min(profiles.length - 2, Math.floor(f));
    const t = THREE.MathUtils.smoothstep(f - k, 0, 1);
    const [z, rx, ry, cy] = profiles[k].map((v, i) => THREE.MathUtils.lerp(v, profiles[k + 1][i], t));
    const ribs = z > -.93 && z < .85 ? Math.sin((z + .91) * 23) * .034 : 0;
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI * 2;
      const irregular = 1 + .023 * Math.sin(j * .9 + a * 7) + .019 * Math.sin(j * .37 - a * 11);
      positions.push(Math.cos(a) * (rx + ribs) * irregular,
        cy + Math.sin(a) * (ry + ribs * .56) * irregular, z);
      uv.push(i / sides * 2, j / rows * 3.4);
      if (j < rows && i < sides) {
        const n = j * (sides + 1) + i, next = n + sides + 1;
        indices.push(n, next, n + 1, n + 1, next, next + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function mouthGeometry() {
  const positions = [], uv = [], indices = [], sides = 36;
  [[.30, .34, .06], [.27, .31, -.10], [.205, .24, -.16], [.15, .18, -.03]]
    .forEach(([rx, ry, z], j) => {
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2, wrinkle = .008 * Math.sin(a * 9);
        positions.push((rx + wrinkle) * Math.cos(a), (ry + wrinkle) * Math.sin(a), z);
        uv.push(i / sides, j / 3);
        if (j < 3 && i < sides) {
          const n = j * (sides + 1) + i, next = n + sides + 1;
          indices.push(n, next, n + 1, n + 1, next, next + 1);
        }
      }
    });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createCreature(scene) {
  const group = new THREE.Group(); scene.add(group);
  const maps = skinMaps();
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: maps.map,
    bumpMap: maps.bumpMap, bumpScale: .045, roughness: .55,
    clearcoat: .21, clearcoatRoughness: .38, side: THREE.DoubleSide });
  const bruised = new THREE.MeshPhysicalMaterial({ color: 0x633533, map: maps.map,
    bumpMap: maps.bumpMap, bumpScale: .03, roughness: .47, side: THREE.DoubleSide });
  const wet = new THREE.MeshPhysicalMaterial({ color: 0x1d090a, roughness: .15,
    clearcoat: 1, side: THREE.DoubleSide });
  const tooth = new THREE.MeshStandardMaterial({ color: 0xc8b4a3, roughness: .39 });
  const body = new THREE.Mesh(torsoGeometry(), skin); body.castShadow = true; group.add(body);

  const maw = new THREE.Group(); maw.position.set(0, 1.5, -1.77); group.add(maw);
  const cavity = new THREE.Mesh(new THREE.CircleGeometry(.19, 32), wet);
  cavity.scale.y = 1.18; cavity.position.z = .015; maw.add(cavity);
  maw.add(new THREE.Mesh(mouthGeometry(), skin));
  makeTube(maw, bruised, [V(-.2, -.23, -.12), V(0, -.29, -.15), V(.2, -.23, -.12)],
    [.05, .07, .05], 16, 9);
  makeTube(maw, bruised, [V(0, -.13, .005), V(0, -.13, -.16), V(0, -.2, -.31)],
    [.08, .06, .006], 13, 8);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(.021 + i % 3 * .004,
      .10 + i % 4 * .02, 7), tooth);
    fang.position.set(Math.cos(a) * .205, Math.sin(a) * .24, -.16);
    fang.quaternion.setFromUnitVectors(V(0, 1, 0),
      V(-Math.cos(a) * .5, -Math.sin(a) * .6, -.8).normalize());
    maw.add(fang);
  }
  // Eyeless brow, tendons and an extended upper face from the supplied reference.
  makeTube(group, skin, [V(-.27, 1.73, -1.52), V(-.13, 1.85, -1.73),
    V(0, 1.81, -1.88), V(.13, 1.85, -1.73), V(.27, 1.73, -1.52)],
  [.08, .11, .12, .11, .08], 28, 10);
  for (const side of [-1, 1])
    makeTube(group, bruised, [V(side * .25, 1.44, -1.53),
      V(side * .31, 1.23, -1.7), V(side * .36, 1.08, -1.8)],
    [.06, .05, .008], 15, 8);

  const limbs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = [-.66, -.2, .35, .86][i];
    const shape = makeTube(group, skin,
      [V(side * .4, 1.43, z), V(side * .68, 1.65, z),
        V(side * 1.02, 1.97, z), V(side * 1.18, .8, z), V(side * 1.32, .08, z)],
      [.15, .125, .09, .057, .043], 25, 11);
    const hand = new THREE.Group(); group.add(hand);
    for (let f = -1; f <= 1; f++)
      makeTube(hand, f === 0 ? skin : bruised,
        [V(f * .035, .02, .04), V(f * .068, -.025, -.07), V(f * .09, -.035, -.17)],
        [.032, .022, .002], 12, 7);
    limbs.push({ side, i, z, shape, hand });
  }

  const rearEye = new THREE.Group(); rearEye.position.set(0, 1.5, 1.38); group.add(rearEye);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(.13, 24), wet);
  eye.scale.y = .72; eye.position.z = .045; rearEye.add(eye);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(.05, 20),
    new THREE.MeshPhysicalMaterial({ color: 0xc6b5a2, roughness: .21, clearcoat: 1 }));
  iris.position.z = .055; rearEye.add(iris);
  for (const sign of [-1, 1])
    makeTube(rearEye, skin, [V(-.17, 0, .025), V(-.09, sign * .09, .075),
      V(0, sign * .12, .09), V(.09, sign * .09, .075), V(.17, 0, .025)],
    [.047, .056, .056, .056, .047], 17, 8);

  const reach = new THREE.Group(); reach.visible = false; scene.add(reach);
  const arm = makeTube(reach, skin, [V(0, .75, 0), V(.06, .25, 0), V(.17, -.8, .1)],
    [.12, .075, .03], 18, 9);
  const hand = new THREE.Group(); reach.add(hand);
  for (let i = -1; i <= 1; i++)
    makeTube(hand, bruised, [V(i * .035, 0, 0), V(i * .09, -.12, -.05),
      V(i * .14, -.28, -.14)], [.03, .022, .002], 12, 7);

  function update(time, motion = 1, eyeOpen = 0, attack = 0) {
    const step = time * (motion > 1 ? 5.1 : 2.7);
    for (const limb of limbs) {
      const { side, i, z } = limb;
      const phase = step + (i % 2 ? Math.PI : 0) + (side < 0 ? Math.PI : 0);
      const swing = Math.sin(phase) * .22 * Math.min(motion, 1.5);
      const lift = Math.max(0, Math.cos(phase)) * .14 * Math.min(motion, 1.5);
      const tip = V(side * (1.3 + i * .02), .075 + lift, z + (i - 1.5) * .13 + swing);
      limb.shape.deform([V(side * .4, 1.43, z), V(side * .68, 1.65, z + swing * .1),
        V(side * (1.0 + i * .025), i < 2 ? 2.03 : 1.86, z + swing * .3),
        V(side * 1.17, .8 + lift * .3, tip.z - swing * .15), tip]);
      limb.hand.position.copy(tip); limb.hand.rotation.y = Math.sin(phase) * .16;
    }
    maw.scale.y = .86 + attack * 1.9 + Math.sin(time * 1.7) * .025;
    rearEye.scale.y = Math.max(.035, eyeOpen);
    iris.position.x = Math.sin(time * 1.1) * .015;
  }

  function setLimb(position, progress) {
    reach.visible = progress > 0 && progress < 1;
    if (!reach.visible) return;
    reach.position.copy(position);
    const tip = V(.18 + Math.sin(progress * 9) * .065,
      -Math.min(progress * 3, 1) * 1.85, .13);
    arm.deform([V(0, .75, 0), V(.06, .25, 0), tip]);
    hand.position.copy(tip);
  }

  return { group, update, setLimb, reach, maw, materials: { flesh: skin, pale: skin } };
}
