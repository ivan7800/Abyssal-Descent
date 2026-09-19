export class AbyssAudio {
    ctx = null;
    master = null;
    drone = null;
    droneGain = null;
    enabled = true;
    ensure() {
        if (typeof window === 'undefined' || !this.enabled)
            return null;
        try {
            const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
            if (!AudioContextCtor)
                return null;
            if (!this.ctx) {
                this.ctx = new AudioContextCtor();
                this.master = this.ctx.createGain();
                this.master.gain.value = .17;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended')
                void this.ctx.resume().catch(() => undefined);
            return this.ctx;
        }
        catch {
            this.ctx = null;
            this.master = null;
            this.stopDrone();
            return null;
        }
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled)
            this.stopDrone();
    }
    startDrone(floor) {
        const ctx = this.ensure();
        if (!ctx || !this.master)
            return;
        this.stopDrone();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = floor >= 3 ? 'sawtooth' : 'sine';
        osc.frequency.value = 38 + floor * 7;
        gain.gain.value = .028;
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        this.drone = osc;
        this.droneGain = gain;
    }
    stopDrone() {
        try {
            this.drone?.stop();
        }
        catch { /* already stopped */ }
        try {
            this.drone?.disconnect();
            this.droneGain?.disconnect();
        }
        catch { /* already disconnected */ }
        this.drone = null;
        this.droneGain = null;
    }
    cue(cue, intensity = 1) {
        const ctx = this.ensure();
        if (!ctx || !this.master)
            return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noiseLike = cue === 'hurt' || cue === 'sanity';
        osc.type = noiseLike ? 'sawtooth' : cue === 'boss' ? 'square' : 'sine';
        const spec = {
            step: [92, .035, .025], turn: [75, .025, .018], pickup: [420, .12, .06], interact: [260, .14, .05],
            attack: [150, .08, .09], critical: [620, .17, .11], hurt: [68, .12, .12], sanity: [47, .26, .08],
            boss: [55, .52, .13], victory: [330, .42, .09], rest: [220, .38, .05], secret: [510, .32, .08],
        };
        const [freq, duration, volume] = spec[cue];
        osc.frequency.setValueAtTime(freq, now);
        if (cue === 'critical' || cue === 'victory' || cue === 'secret')
            osc.frequency.exponentialRampToValueAtTime(freq * 1.7, now + duration);
        if (cue === 'hurt' || cue === 'sanity')
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * .45), now + duration);
        gain.gain.setValueAtTime(volume * intensity, now);
        gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + duration + .02);
    }
}
