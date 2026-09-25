import * as THREE from '../vendor/three.bundle.js';

const names = [
  'breath-low', 'breath-close', 'run-metal', 'ladder-metal', 'steps-heavy',
  'metal-groan', 'steps-metal', 'steps-soft', 'metal-squeak', 'metal-impact',
  'fan', 'jump-rise', 'jump-hit', 'jump-squeak', 'jump-creature',
];

export class GameAudio {
  constructor() {
    this.context = null; this.buffers = new Map(); this.loops = new Set(); this.muted = false;
  }

  async init() {
    if (this.context) { await this.context.resume(); return; }
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -13; compressor.ratio.value = 3; compressor.connect(this.context.destination);
    this.master = this.context.createGain(); this.master.gain.value = .67; this.master.connect(compressor);
    await Promise.allSettled(names.map(async name => {
      const response = await fetch(`./audio/${name}.mp3`);
      if (!response.ok) throw new Error(`Nie udało się załadować ${name}`);
      this.buffers.set(name, await this.context.decodeAudioData(await response.arrayBuffer()));
    }));
  }

  listener(position, direction) {
    if (!this.context) return;
    const l = this.context.listener, t = this.context.currentTime;
    l.positionX.setTargetAtTime(position.x, t, .035);
    l.positionY.setTargetAtTime(position.y, t, .035);
    l.positionZ.setTargetAtTime(position.z, t, .035);
    l.forwardX.setTargetAtTime(direction.x, t, .035);
    l.forwardY.setTargetAtTime(direction.y, t, .035);
    l.forwardZ.setTargetAtTime(direction.z, t, .035);
    l.upX.setTargetAtTime(0, t, .035); l.upY.setTargetAtTime(1, t, .035); l.upZ.setTargetAtTime(0, t, .035);
  }

  play(name, position = null, options = {}) {
    if (!this.context || !this.buffers.has(name)) return null;
    const { gain = 1, rate = 1, offset = 0, duration, loop = false, ref = 2.2, lowpass } = options;
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(name); source.playbackRate.value = rate; source.loop = loop;
    const volume = this.context.createGain(); volume.gain.value = gain;
    let panner = null;
    let output = volume;
    if (lowpass) {
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = lowpass;
      volume.connect(filter); output = filter;
    }
    if (position) {
      panner = this.context.createPanner(); panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse'; panner.refDistance = ref;
      panner.maxDistance = 55; panner.rolloffFactor = .95;
      panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
      source.connect(volume); output.connect(panner); panner.connect(this.master);
    } else { source.connect(volume); output.connect(this.master); }
    const start = Math.max(0, Math.min(offset, source.buffer.duration - .05));
    if (loop) source.start(0, start);
    else if (duration) source.start(0, start, Math.min(duration, source.buffer.duration - start));
    else source.start(0, start);
    const handle = {
      setPosition: p => {
        if (!panner) return;
        const t = this.context.currentTime;
        panner.positionX.setTargetAtTime(p.x, t, .065);
        panner.positionY.setTargetAtTime(p.y, t, .065);
        panner.positionZ.setTargetAtTime(p.z, t, .065);
      },
      setGain: v => volume.gain.setTargetAtTime(v, this.context.currentTime, .11),
      stop: () => { try { source.stop(); } catch { /* already stopped */ } this.loops.delete(handle); },
    };
    if (loop) this.loops.add(handle);
    return handle;
  }

  stopAll() { for (const sound of [...this.loops]) sound.stop(); }
  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .67, this.context.currentTime, .05);
  }
}

export function vec(x, y, z) { return new THREE.Vector3(x, y, z); }
