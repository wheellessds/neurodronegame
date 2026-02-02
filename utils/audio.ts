export const SoundManager = {
  ctx: null as AudioContext | null,
  thrustCooldown: 0,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  play(type: 'thrust' | 'coin' | 'damage' | 'crash' | 'shop' | 'win') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    // Create nodes
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'thrust') {
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