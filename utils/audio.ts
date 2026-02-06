export const SoundManager = {
  ctx: null as AudioContext | null,
  thrustCooldown: 0,
  // Wind system state
  windNodes: null as { sources: (AudioBufferSourceNode | OscillatorNode)[], windFilter: BiquadFilterNode, shimmerFilter: BiquadFilterNode, windGain: GainNode, shimmerGain: GainNode, lfoGain: GainNode, master: GainNode } | null,
  windNoiseBuffer: null as AudioBuffer | null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    // Pre-generate noise buffer for wind sound
    if (this.ctx && !this.windNoiseBuffer) {
      const sr = this.ctx.sampleRate;
      const len = sr * 2; // 2 second loop
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      // Brownian (red) noise - smoother, more wind-like
      let last = 0;
      for (let i = 0; i < len; i++) {
        last += (Math.random() * 2 - 1) * 0.1;
        last *= 0.98;
        data[i] = last;
      }
      let max = 0;
      for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(data[i]));
      if (max > 0) for (let i = 0; i < len; i++) data[i] /= max;
      this.windNoiseBuffer = buf;
    }
  },

  startWind() {
    if (!this.ctx || this.windNodes || !this.windNoiseBuffer) return;
    const t = this.ctx.currentTime;

    const master = this.ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.connect(this.ctx.destination);

    // Layer 1: Deep wind body (lowpass filtered noise - 呼呼聲)
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.windNoiseBuffer;
    wind.loop = true;
    wind.playbackRate.value = 0.6; // Slower playback = deeper, smoother
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(150, t);
    windFilter.Q.setValueAtTime(0.7, t);
    const windGain = this.ctx.createGain();
    windGain.gain.setValueAtTime(0, t);
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start(t);

    // Layer 2: Wind wavering modulation (LFO on filter = 呼～呼～ pulsation)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(1.5, t); // 1.5Hz = slow "呼...呼..." rhythm
    lfoGain.gain.setValueAtTime(60, t); // Modulate filter freq ±60Hz
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start(t);

    // Layer 3: Light mid-tone breath (bandpass, very subtle, adds warmth)
    const shimmer = this.ctx.createBufferSource();
    shimmer.buffer = this.windNoiseBuffer;
    shimmer.loop = true;
    shimmer.playbackRate.value = 0.8;
    const shimmerFilter = this.ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.setValueAtTime(250, t);
    shimmerFilter.Q.setValueAtTime(1.2, t);
    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, t);
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(master);
    shimmer.start(t);

    master.gain.setValueAtTime(1, t);

    this.windNodes = {
      sources: [wind, shimmer, lfo as any],
      windFilter, shimmerFilter,
      windGain, shimmerGain,
      lfoGain,
      master
    };
  },

  // speed: magnitude of drone velocity (typically 0~30+)
  updateWind(speed: number) {
    if (!this.ctx || !this.windNodes) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(speed / 25, 1); // 0..1
    const norm2 = norm * norm;

    // Deep wind volume: very quiet at normal speed, louder at high speed
    this.windNodes.windGain.gain.setTargetAtTime(norm2 * 0.05, t, 0.12);
    // Mid breath volume: only audible at high speeds
    this.windNodes.shimmerGain.gain.setTargetAtTime(Math.max(0, (norm - 0.5)) * 0.06, t, 0.12);
    // Lowpass opens with speed: 150 → 500Hz (more body at high speed)
    this.windNodes.windFilter.frequency.setTargetAtTime(150 + norm * 350, t, 0.2);
    // Mid breath filter shifts up: 250 → 450Hz
    this.windNodes.shimmerFilter.frequency.setTargetAtTime(250 + norm * 200, t, 0.2);
    // LFO depth increases with speed: ±60 → ±120Hz
    this.windNodes.lfoGain.gain.setTargetAtTime(60 + norm * 60, t, 0.2);
  },

  stopWind() {
    if (!this.ctx || !this.windNodes) return;
    const t = this.ctx.currentTime;
    this.windNodes.master.gain.cancelScheduledValues(t);
    this.windNodes.master.gain.setValueAtTime(this.windNodes.master.gain.value, t);
    this.windNodes.master.gain.linearRampToValueAtTime(0, t + 0.4);
    const nodes = this.windNodes;
    this.windNodes = null;
    setTimeout(() => {
      nodes.sources.forEach(s => { try { s.stop(); } catch {} });
    }, 500);
  },

  play(type: 'thrust' | 'coin' | 'damage' | 'crash' | 'shop' | 'win' | 'boost') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Create nodes
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'boost') {
        // Sonic boom - punchy impact + rising whoosh
        // Layer 1: Impact thud
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);

        // Layer 2: Noise burst (use wind buffer if available)
        if (this.windNoiseBuffer) {
            const noiseSrc = this.ctx.createBufferSource();
            noiseSrc.buffer = this.windNoiseBuffer;
            const noiseFilt = this.ctx.createBiquadFilter();
            noiseFilt.type = 'bandpass';
            noiseFilt.frequency.setValueAtTime(400, t);
            noiseFilt.frequency.exponentialRampToValueAtTime(1800, t + 0.2);
            noiseFilt.Q.setValueAtTime(0.6, t);
            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
            noiseSrc.connect(noiseFilt);
            noiseFilt.connect(noiseGain);
            noiseGain.connect(this.ctx.destination);
            noiseSrc.start(t);
            noiseSrc.stop(t + 0.5);
        }

    } else if (type === 'thrust') {
        // Throttling thrust sound to prevent audio glitching
        const now = Date.now();
        if (now - this.thrustCooldown < 80) return;
        this.thrustCooldown = now;

        // Low sputtering engine sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, t);
        osc.frequency.linearRampToValueAtTime(40, t + 0.08);
        
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.08);
        
        osc.start(t);
        osc.stop(t + 0.08);

    } else if (type === 'coin') {
        // High pitch "Ding"
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);
        
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        
        osc.start(t);
        osc.stop(t + 0.4);

    } else if (type === 'damage') {
        // Dull mechanical thud
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.15);
        
        osc.start(t);
        osc.stop(t + 0.15);

    } else if (type === 'crash') {
        // Explosive noise approximation
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.6);
        
        // Tremolo for roughness
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        
        osc.start(t);
        osc.stop(t + 0.6);

    } else if (type === 'shop') {
        // UI blip
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(660, t + 0.05);
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.1);
        
        osc.start(t);
        osc.stop(t + 0.1);

    } else if (type === 'win') {
        // Simple major arpeggio
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
        osc.frequency.setValueAtTime(1046.50, t + 0.3); // C6
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.setValueAtTime(0.1, t + 0.3);
        gain.gain.linearRampToValueAtTime(0, t + 0.6);
        
        osc.start(t);
        osc.stop(t + 0.6);
    }
  }
};