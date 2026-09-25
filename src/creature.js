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
  const positions = [], uv = [], colors = [], indices = [], sides = 36;
  const gum = [[1, 1, 1], [.85, .69, .65], [.52, .26, .27], [.32, .12, .14]];
  [[.33, .215, .06], [.315, .19, -.095], [.265, .135, -.145], [.23, .09, -.03]]
    .forEach(([rx, ry, z], j) => {
      for (let i = 0; i <= sides; i++) {
        const a = i / sides * Math.PI * 2, wrinkle = .008 * Math.sin(a * 9);
        const lower = Math.sin(a) < 0 ? .72 : 1;
        positions.push((rx + wrinkle) * Math.cos(a), (ry + wrinkle) * Math.sin(a) * lower, z);
        uv.push(i / sides, j / 3);
        colors.push(...gum[j]);
        if (j < 3 && i < sides) {
          const n = j * (sides + 1) + i, next = n + sides + 1;
          indices.push(n, next, n + 1, n + 1, next, next + 1);
        }
      }
    });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// Raised, eyeless cranial crest with a pointed nose and hollow cheek margins.
function skullGeometry() {
  const profiles = [
    [-1.33, .25, 1.65, .15], [-1.53, .31, 1.69, .22],
    [-1.72, .28, 1.76, .22], [-1.87, .21, 1.83, .20],
    [-2.04, .10, 1.96, .13], [-2.13, .015, 2.06, .025],
  ];
  const positions = [], uv = [], indices = [], rows = 35, sides = 20;
  for (let j = 0; j <= rows; j++) {
    const f = j / rows * (profiles.length - 1);
    const k = Math.min(profiles.length - 2, Math.floor(f)), t = f - k;
    const [z, width, y, height] = profiles[k]
      .map((value, i) => THREE.MathUtils.lerp(value, profiles[k + 1][i], t));
    for (let i = 0; i <= sides; i++) {
      const a = i / sides * Math.PI;
      const vein = .007 * Math.sin(j * .8 + a * 6);
      positions.push(Math.cos(a) * (width + vein),
        y + Math.sin(a) * (height + vein) + .018 * Math.cos(a * 2), z);
      uv.push(i / sides, j / rows * 1.7);
      if (j < rows && i < sides) {
        const n = j * (sides + 1) + i, next = n + sides + 1;
        indices.push(n, n + 1, next, n + 1, next + 1, next);
      }
    }
  }
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
  const lipSkin = skin.clone(); lipSkin.vertexColors = true;
  const tooth = new THREE.MeshStandardMaterial({ color: 0xa59687, roughness: .47 });
  const tongueFlesh = new THREE.MeshPhysicalMaterial({ color: 0x7b272d, roughness: .27,
    clearcoat: .83, clearcoatRoughness: .18, side: THREE.DoubleSide });
  const body = new THREE.Mesh(torsoGeometry(), skin); body.castShadow = true; group.add(body);
  const skull = new THREE.Mesh(skullGeometry(), skin); skull.castShadow = true; group.add(skull);
  // Uneven rib crests, stretched tendons and wounds cut into the back and chest.
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
    const z = -.72 + i * .265, width = i < 4 ? .48 : .41;
    makeTube(group, i % 3 === 0 ? bruised : skin,
      [V(side * (width - .065), 1.49, z - .09),
        V(side * (width + .018), 1.67, z),
        V(side * .20, 1.79, z + .045), V(0, 1.80, z + .04)],
      [.028, .039, .029, .006], 15, 7);
  }
  for (const side of [-1, 1]) {
    makeTube(group, bruised, [V(side * .23, 1.63, -.85), V(side * .29, 1.34, -.63),
      V(side * .17, 1.18, -.28), V(side * .07, 1.12, .09)],
    [.016, .03, .025, .006], 25, 7);
    makeTube(group, skin, [V(side * .25, 1.69, -1.48),
      V(side * .29, 1.58, -1.71), V(side * .31, 1.37, -1.86),
      V(side * .19, 1.25, -1.93)], [.075, .1, .08, .025], 27, 10);
    makeTube(group, bruised, [V(side * .06, 1.98, -2.055),
      V(side * .07, 1.86, -2.08), V(side * .10, 1.82, -2.01)],
    [.004, .019, .003], 12, 7);
  }

  const maw = new THREE.Group(); maw.position.set(0, 1.5, -1.77); group.add(maw);
  const cavity = new THREE.Mesh(new THREE.CircleGeometry(.235, 32), wet);
  cavity.scale.y = .55; cavity.position.z = .015; maw.add(cavity);
  maw.add(new THREE.Mesh(mouthGeometry(), lipSkin));
  const lowerJaw = new THREE.Group(); maw.add(lowerJaw);
  makeTube(lowerJaw, skin, [V(-.26, -.12, -.04), V(-.14, -.22, -.13),
    V(0, -.27, -.17), V(.14, -.22, -.13), V(.26, -.12, -.04)],
    [.065, .10, .12, .10, .065], 25, 11);
  makeTube(lowerJaw, bruised, [V(-.24, -.13, -.12), V(0, -.19, -.15), V(.24, -.13, -.12)],
    [.05, .07, .05], 16, 9);
  makeTube(maw, wet, [V(0, 0, .10), V(0, 0, .25), V(0, -.02, .39)],
    [.18, .115, .035], 17, 10);
  const tongue = makeTube(maw, tongueFlesh,
    [V(0, -.025, .01), V(0, -.08, -.18), V(0, -.22, -.34),
      V(0, -.43, -.36)], [.085, .075, .052, .004], 22, 10);
  const saliva = new THREE.Group(); maw.add(saliva);
  makeTube(saliva, new THREE.MeshPhysicalMaterial({ color: 0x8d514b, roughness: .08,
    transparent: true, opacity: .62, clearcoat: 1 }),
  [V(.075, -.11, -.13), V(.067, -.24, -.23), V(.045, -.43, -.25)],
  [.006, .004, .001], 11, 5);
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * .062;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(.023 + i % 3 * .004,
      .105 + i % 4 * .019, 7), tooth);
    fang.position.set(x, .095 + (1 - Math.abs(x) / .3) * .034, -.17);
    fang.rotation.z = Math.PI + x * .5; maw.add(fang);
  }
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * .084;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(.018 + i % 2 * .003,
      .07 + i % 3 * .012, 7), tooth);
    fang.position.set(x, -.128, -.14);
    fang.rotation.z = x * .35; lowerJaw.add(fang);
  }
  // The raised central bridge of the skull follows the pointed reference silhouette.
  makeTube(group, skin, [V(-.27, 1.73, -1.52), V(-.13, 1.85, -1.73),
    V(0, 2.08, -2.09), V(.13, 1.85, -1.73), V(.27, 1.73, -1.52)],
  [.06, .065, .055, .065, .06], 28, 10);
  for (const side of [-1, 1])
    makeTube(group, bruised, [V(side * .25, 1.44, -1.53),
      V(side * .31, 1.23, -1.7), V(side * .36, 1.08, -1.8)],
    [.06, .05, .008], 15, 8);

  const limbs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = [-.73, -.27, .34, .83][i];
    const kneeZ = [-.94, -.51, .91, 1.27][i];
    const kneeY = [1.74, 2.05, 2.05, 1.94][i];
    const outerX = [1.43, 1.47, 1.17, .96][i];
    const footZ = [-1.87, -1.29, .98, 1.64][i];
    const knee = V(side * (i < 2 ? 1.02 : .93), kneeY, kneeZ);
    const tip = V(side * outerX, .065, footZ);
    const shape = makeTube(group, skin,
      [V(side * .4, 1.43, z), V(side * .65, 1.57, z),
        knee, V(side * (outerX - .08), 1.2, (kneeZ + footZ) / 2),
        V(side * outerX, .37, footZ + .13), tip],
      [.15, .13, .099, .073, .05, .04], 33, 12);
    const hand = new THREE.Group(); group.add(hand);
    makeTube(hand, skin, [V(0, .025, .08), V(0, .025, -.06), V(0, .018, -.17)],
      [.06, .085, .027], 17, 9);
    for (let f = -2; f <= 2; f++) {
      const spread = f * .052, length = .18 + (2 - Math.abs(f)) * .058;
      makeTube(hand, f === 0 ? skin : bruised,
        [V(spread * .62, .012, -.12), V(spread * 1.3, -.012, -.2),
          V(spread * 1.5, -.018, -.20 - length * .52),
          V(spread * 1.65, -.023, -.20 - length)],
        [.031, .026, .014, .001], 16, 7);
      const nail = new THREE.Mesh(new THREE.ConeGeometry(.015, .075, 6), tooth);
      nail.position.set(spread * 1.65, -.015, -.20 - length);
      nail.rotation.x = -Math.PI / 2; hand.add(nail);
    }
    const scar = new THREE.Mesh(new THREE.PlaneGeometry(.12, .19),
      new THREE.MeshStandardMaterial({ color: 0x773f3a, roughness: .83,
        transparent: true, opacity: .85, side: THREE.DoubleSide }));
    scar.rotation.y = side * .4; group.add(scar);
    limbs.push({ side, i, z, kneeZ, kneeY, outerX, footZ, shape, hand, scar });
  }

  const rearEye = new THREE.Group(); rearEye.position.set(0, 1.5, 1.38); group.add(rearEye);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(.13, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x260d0e, roughness: .16,
      emissive: 0x290709, emissiveIntensity: .6, clearcoat: 1, side: THREE.DoubleSide }));
  eye.scale.y = .72; eye.position.z = .045; rearEye.add(eye);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(.05, 20),
    new THREE.MeshPhysicalMaterial({ color: 0xbda693, roughness: .21,
      emissive: 0x754326, emissiveIntensity: .52, clearcoat: 1 }));
  iris.position.z = .055; rearEye.add(iris);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(.011, 12),
    new THREE.MeshBasicMaterial({ color: 0xe7c9a9, toneMapped: false }));
  glint.position.set(-.018, .02, .058); rearEye.add(glint);
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
    const step = time * (motion > 1 ? 6.1 : 2.8);
    const breath = Math.sin(time * 1.9);
    body.scale.set(1 + breath * .022, 1 + breath * .012, 1 + breath * .008);
    skull.position.y = breath * .009;
    for (const limb of limbs) {
      const { side, i, z, kneeZ, kneeY, outerX, footZ } = limb;
      const phase = step + (i % 2 ? Math.PI : 0) + (side < 0 ? Math.PI : 0);
      const swing = Math.sin(phase) * .23 * Math.min(motion, 1.7);
      const lift = Math.max(0, Math.cos(phase)) * .17 * Math.min(motion, 1.7);
      const tip = V(side * outerX, .065 + lift, footZ + swing);
      const knee = V(side * (i < 2 ? 1.02 : .93), kneeY + lift * .18,
        kneeZ + swing * .32);
      limb.shape.deform([V(side * .4, 1.43, z), V(side * .65, 1.57 + breath * .025, z + swing * .08),
        knee, V(side * (outerX - .08), 1.2 + lift * .3, (knee.z + tip.z) / 2),
        V(side * outerX, .37 + lift * .55, tip.z + .13), tip]);
      limb.hand.position.copy(tip);
      limb.hand.rotation.set(0, Math.sin(phase) * .15 + side * .12, Math.sin(phase + i) * .07);
      limb.scar.position.copy(knee).add(V(side * .025, .015, -.093));
    }
    maw.position.y = 1.5 + breath * .015;
    maw.scale.y = .86 + attack * .75 + Math.sin(time * 1.7) * .025;
    lowerJaw.position.y = -attack * .30;
    lowerJaw.rotation.x = -attack * .17;
    tongue.mesh.rotation.z = Math.sin(time * 2.3) * (.04 + attack * .13);
    saliva.rotation.z = Math.sin(time * 1.5) * .13;
    const blink = (time % 6.9 > 6.76) ? .2 : 1;
    rearEye.scale.y = Math.max(.035, eyeOpen * blink);
    iris.position.x = Math.sin(time * 1.1) * .027;
    iris.position.y = Math.sin(time * .8) * .012;
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
