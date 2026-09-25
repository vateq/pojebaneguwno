import * as THREE from '../vendor/three.bundle.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function sphere(parent, material, pos, scale, width = 14, height = 10) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, width, height), material);
  mesh.position.set(...pos); mesh.scale.set(...scale); parent.add(mesh); return mesh;
}
function segment(parent, material, radiusA, radiusB, sides = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusA, radiusB, 1, sides), material);
  parent.add(mesh); return mesh;
}
function poseSegment(mesh, from, to) {
  const delta = to.clone().sub(from);
  mesh.position.copy(from).addScaledVector(delta, .5);
  mesh.scale.y = delta.length();
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), delta.normalize());
}

export function createCreature(scene) {
  const group = new THREE.Group(); scene.add(group);
  const flesh = new THREE.MeshPhysicalMaterial({ color: 0x8c7668, roughness: .49, metalness: .06, clearcoat: .22, clearcoatRoughness: .47 });
  const pale = new THREE.MeshPhysicalMaterial({ color: 0xb9a091, roughness: .56, clearcoat: .12 });
  const tendon = new THREE.MeshStandardMaterial({ color: 0x543b38, roughness: .52 });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x130a0b, roughness: .3, side: THREE.DoubleSide });
  const teeth = new THREE.MeshStandardMaterial({ color: 0xb1aba0, roughness: .43 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xc2aaa0 });
  const eyeDark = new THREE.MeshBasicMaterial({ color: 0x100b0d });

  sphere(group, flesh, [0, 1.47, .12], [.53, .38, .94], 24, 16);
  sphere(group, pale, [0, 1.42, -.68], [.4, .31, .48], 20, 14);
  sphere(group, flesh, [0, 1.46, .82], [.39, .37, .43], 18, 12);
  for (let i = 0; i < 7; i++) {
    const z = -.52 + i * .23;
    const rib = sphere(group, i % 2 ? pale : flesh,
      [0, 1.51 + Math.sin(i * .7) * .025, z], [.54 - Math.abs(z) * .08, .3, .085], 16, 8);
    rib.rotation.z = i % 2 ? .065 : -.065;
  }
  for (let i = 0; i < 5; i++) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(.12 - i * .009, .32, 6), pale);
    spine.position.set(0, 1.8, -.42 + i * .3); spine.rotation.x = -.3;
    group.add(spine);
  }

  // The face points toward local -Z. The rear eye faces +Z.
  const head = sphere(group, pale, [0, 1.48, -1.04], [.31, .36, .36], 22, 14);
  head.rotation.x = -.25;
  sphere(group, tendon, [0, 1.19, -1.36], [.27, .11, .26]);
  const maw = new THREE.Group(); maw.position.set(0, 1.42, -1.38); group.add(maw);
  const throat = sphere(maw, cavity, [0, -.02, -.055], [.255, .205, .032], 20, 16);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.225, .065, 8, 25), tendon);
  rim.position.z = -.11; maw.add(rim);
  const jaw = sphere(maw, flesh, [0, -.19, -.06], [.26, .085, .19], 14, 9);
  const tongue = sphere(maw, tendon, [0, -.08, -.17], [.09, .036, .16], 12, 8);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(.024 + (i % 3) * .006, .12 + (i % 4) * .024, 5), teeth);
    tooth.position.set(Math.sin(a) * .21, Math.cos(a) * .2, -.18);
    tooth.rotation.z = Math.PI + a; maw.add(tooth);
  }
  for (const side of [-1, 1]) {
    const feeler = segment(group, tendon, .055, .028);
    poseSegment(feeler, V(side * .24, 1.28, -1.22), V(side * .34, 1.12, -1.65));
    sphere(group, flesh, [side * .34, 1.12, -1.65], [.047, .047, .047]);
  }

  const limbs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const upper = segment(group, flesh, .075, .095, 9);
    const lower = segment(group, pale, .043, .075, 8);
    const joint = sphere(group, tendon, [0, 0, 0], [.09, .085, .09], 10, 7);
    const hand = new THREE.Group(); group.add(hand);
    for (let finger = -1; finger <= 1; finger++) {
      const claw = segment(hand, tendon, .012, .032, 5);
      poseSegment(claw, V(finger * .035, .025, 0), V(finger * .075, -.065, -.08));
    }
    limbs.push({ side, i, upper, lower, joint, hand });
  }

  const rearEye = new THREE.Group(); rearEye.position.set(0, 1.58, 1.16); group.add(rearEye);
  sphere(rearEye, tendon, [0, 0, 0], [.2, .18, .085]);
  const eyeball = sphere(rearEye, eyeWhite, [0, 0, .067], [.138, .132, .068], 16, 10);
  const pupil = sphere(rearEye, eyeDark, [0, 0, .126], [.054, .061, .015], 12, 8);
  const upperLid = sphere(rearEye, flesh, [0, .067, .135], [.175, .116, .05]);
  const lowerLid = sphere(rearEye, flesh, [0, -.067, .135], [.175, .116, .05]);

  const reach = new THREE.Group(); reach.visible = false; scene.add(reach);
  const reachArm = segment(reach, pale, .075, .14);
  const reachHand = sphere(reach, flesh, [0, 0, 0], [.12, .16, .09]);
  const reachFingers = [];
  for (let i = -1; i <= 1; i++) {
    const finger = segment(reach, tendon, .02, .04, 6);
    reachFingers.push(finger);
  }

  function update(time, motion = 1, eye = 0, attack = 0) {
    const step = time * (motion > 1.2 ? 7.5 : 4.2);
    // Vertical locomotion is set by the AI; joints are animated locally.
    for (const leg of limbs) {
      const { side, i } = leg;
      const phase = step + (i % 2 ? Math.PI : 0) + (side < 0 ? Math.PI : 0);
      const z = -.65 + i * .45;
      const swing = Math.sin(phase) * .22 * Math.min(motion, 1.7);
      const lift = Math.max(0, Math.cos(phase)) * .19 * Math.min(motion, 1.6);
      const start = V(side * .39, 1.42, z);
      const knee = V(side * (1.02 + i * .045), .95 + lift * .45, z + (i - 1.5) * .12 + swing * .35);
      const foot = V(side * (1.36 + i * .035), .11 + lift, z + (i - 1.5) * .22 + swing);
      poseSegment(leg.upper, start, knee); poseSegment(leg.lower, knee, foot);
      leg.joint.position.copy(knee); leg.hand.position.copy(foot);
      leg.hand.rotation.y = Math.sin(phase) * .22;
    }
    const gape = .8 + attack * 2.1 + Math.sin(time * 2.8) * .08;
    rim.scale.y = gape; throat.scale.y = gape;
    jaw.position.y = -.19 - attack * .29;
    tongue.position.y = -.08 - attack * .11;
    rearEye.scale.y = Math.max(.08, eye);
    upperLid.position.y = .067 + eye * .13;
    lowerLid.position.y = -.067 - eye * .13;
    pupil.visible = eyeball.visible = eye > .16;
    pupil.position.x = Math.sin(time * 1.4) * .016;
  }

  function setLimb(position, progress) {
    reach.visible = progress > 0 && progress < 1;
    if (!reach.visible) return;
    reach.position.copy(position);
    const tip = V(.18 + Math.sin(progress * 9) * .07, -Math.min(progress * 3, 1) * 1.85, .15);
    poseSegment(reachArm, V(0, .75, 0), tip);
    reachHand.position.copy(tip);
    reachFingers.forEach((finger, i) => poseSegment(finger,
      tip.clone().add(V((i - 1) * .045, -.02, 0)),
      tip.clone().add(V((i - 1) * .13, -.34, -.15))));
  }

  return { group, update, setLimb, reach, maw, materials: { flesh, pale } };
}
