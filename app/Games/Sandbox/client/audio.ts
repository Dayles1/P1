/**
 * Every sound in the game, made on the fly with the Web Audio API — no
 * sound files. Short effects (steps, blows, splashes) are shaped noise
 * bursts and tones; the ambience (wind, water, birds by day, crickets at
 * night, a crackling fire) is mixed from where the player is and the time
 * of day. Under water everything is muffled.
 *
 * Audio can only start after a user gesture, so start() is called from
 * the click or tap that starts the game.
 */

export type Surface = 'grass' | 'sand' | 'snow' | 'stone' | 'wood' | 'water';
export type HitMaterial = 'wood' | 'stone' | 'ore' | 'cactus' | 'air';

export interface Ambience {
    night: number;
    /** 0…1 how much of each place is around. */
    forest: number;
    open: number;
    windy: number;
    nearWater: number;
    fire: number;
    underwater: boolean;
}

const MUTE_KEY = 'sandbox-muted';

export class Sound {
    private context: AudioContext | null = null;
    private master!: GainNode;
    private muffle!: BiquadFilterNode;
    private noise!: AudioBuffer;
    private wind!: GainNode;
    private windFilter!: BiquadFilterNode;
    private water!: GainNode;
    private fireRumble!: GainNode;
    private nextBird = 0;
    private nextCricket = 0;
    private nextCrackle = 0;
    muted: boolean;
    volume = 0.8;

    constructor() {
        try {
            this.muted = localStorage.getItem(MUTE_KEY) === '1';
        } catch {
            this.muted = false;
        }
    }

    start(): void {
        if (this.context) {
            void this.context.resume();

            return;
        }

        const AudioContextClass =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;

        if (!AudioContextClass) {
            return;
        }

        const context = new AudioContextClass();
        this.context = context;

        this.muffle = context.createBiquadFilter();
        this.muffle.type = 'lowpass';
        this.muffle.frequency.value = 20000;
        this.master = context.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.muffle.connect(this.master).connect(context.destination);

        this.noise = context.createBuffer(
            1,
            context.sampleRate * 2,
            context.sampleRate,
        );
        const data = this.noise.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        [this.wind, this.windFilter] = this.loop('bandpass', 420, 0.6);
        [this.water] = this.loop('lowpass', 520, 0.7);
        [this.fireRumble] = this.loop('lowpass', 180, 0.8);
    }

    toggleMuted(): boolean {
        this.muted = !this.muted;

        try {
            localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
        } catch {
            // Not remembered — fine.
        }

        if (this.context) {
            this.master.gain.setTargetAtTime(
                this.muted ? 0 : this.volume,
                this.context.currentTime,
                0.05,
            );
        }

        return this.muted;
    }

    footstep(surface: Surface, loudness = 1): void {
        const settings: Record<
            Surface,
            [BiquadFilterType, number, number, number]
        > = {
            grass: ['lowpass', 1300, 0.07, 0.16],
            sand: ['bandpass', 2600, 0.09, 0.12],
            snow: ['lowpass', 900, 0.12, 0.2],
            stone: ['bandpass', 1800, 0.04, 0.16],
            wood: ['bandpass', 500, 0.05, 0.2],
            water: ['lowpass', 700, 0.18, 0.22],
        };
        const [type, frequency, duration, gain] = settings[surface];
        this.burst(
            type,
            frequency * (0.85 + Math.random() * 0.3),
            duration,
            gain * loudness,
        );

        if (surface === 'snow') {
            this.burst('highpass', 3500, 0.05, 0.05 * loudness, 0.04);
        }

        if (surface === 'wood') {
            this.tone('sine', 140, 90, 0.08, 0.12 * loudness);
        }
    }

    jump(): void {
        this.burst('bandpass', 900, 0.12, 0.07);
    }

    land(speed: number): void {
        const loudness = Math.min(1, speed / 14);
        this.tone('sine', 110, 50, 0.14, 0.25 * loudness);
        this.burst('lowpass', 600, 0.12, 0.18 * loudness);
    }

    hit(material: HitMaterial): void {
        switch (material) {
            case 'wood':
                this.tone('triangle', 190, 120, 0.14, 0.35);
                this.burst('bandpass', 1200, 0.05, 0.25);
                break;
            case 'stone':
                this.burst('bandpass', 3200, 0.06, 0.3);
                this.tone('square', 900, 600, 0.04, 0.05);
                break;
            case 'ore':
                this.burst('bandpass', 3200, 0.06, 0.25);
                this.tone('sine', 1250, 1240, 0.35, 0.12);
                this.tone('sine', 1870, 1860, 0.3, 0.07);
                break;
            case 'cactus':
                this.burst('lowpass', 900, 0.08, 0.25);
                break;
            case 'air':
                this.burst('bandpass', 700, 0.15, 0.06);
                break;
        }
    }

    treeCreak(): void {
        this.tone('sawtooth', 210, 70, 1.2, 0.05, 900);
    }

    treeCrash(): void {
        this.burst('lowpass', 500, 0.6, 0.45);
        this.tone('sine', 80, 40, 0.4, 0.3);
    }

    pickup(): void {
        this.tone('sine', 620, 940, 0.09, 0.12);
    }

    craft(): void {
        this.tone('triangle', 660, 660, 0.12, 0.12);
        window.setTimeout(
            () => this.tone('triangle', 990, 990, 0.18, 0.12),
            110,
        );
    }

    place(): void {
        this.tone('sine', 160, 90, 0.15, 0.25);
        this.burst('lowpass', 800, 0.1, 0.15);
    }

    broke(): void {
        this.burst('bandpass', 2500, 0.15, 0.25);
        this.tone('square', 400, 120, 0.2, 0.06);
    }

    splash(size: number): void {
        this.burst('lowpass', 1400, 0.25 + size * 0.3, 0.15 + size * 0.3);
        this.burst('bandpass', 3000, 0.15, 0.06 + size * 0.1, 0.05);
    }

    stroke(): void {
        this.burst('lowpass', 900, 0.22, 0.09);
    }

    artifact(): void {
        [523, 659, 784, 1047].forEach((frequency, index) =>
            window.setTimeout(
                () => this.tone('sine', frequency, frequency, 0.4, 0.1),
                index * 90,
            ),
        );
    }

    click(): void {
        this.tone('sine', 900, 700, 0.04, 0.06);
    }

    /** The player takes a blow. */
    hurt(): void {
        this.tone('sine', 180, 70, 0.22, 0.32);
        this.burst('lowpass', 700, 0.12, 0.3);
    }

    /** A blow lands on a creature. */
    strike(): void {
        this.burst('lowpass', 900, 0.09, 0.35);
        this.tone('triangle', 240, 110, 0.1, 0.18);
    }

    /** A creature's voice: a bleat, a grunt, a growl or a moan. */
    call(type: 'deer' | 'boar' | 'wolf' | 'zombie', distance: number): void {
        const loudness = Math.max(0, 1 - distance / 40);

        if (loudness <= 0) {
            return;
        }

        switch (type) {
            case 'deer':
                this.tone('triangle', 620, 420, 0.35, 0.08 * loudness, 1800);
                break;
            case 'boar':
                this.tone('sawtooth', 120, 85, 0.25, 0.12 * loudness, 500);
                this.burst('lowpass', 400, 0.2, 0.1 * loudness);
                break;
            case 'wolf':
                this.tone('sawtooth', 140, 95, 0.6, 0.12 * loudness, 450);
                break;
            case 'zombie':
                this.tone('sawtooth', 110, 80, 1.1, 0.1 * loudness, 380);
                this.tone('sine', 160, 120, 1.0, 0.06 * loudness);
                break;
        }
    }

    /** A creature falls. */
    fall(): void {
        this.burst('lowpass', 500, 0.35, 0.3);
        this.tone('sine', 120, 45, 0.3, 0.2);
    }

    eat(): void {
        [0, 120, 240].forEach((delay) =>
            window.setTimeout(
                () => this.burst('bandpass', 1600, 0.06, 0.18),
                delay,
            ),
        );
    }

    heal(): void {
        this.tone('sine', 520, 780, 0.25, 0.1);
    }

    death(): void {
        this.tone('triangle', 330, 110, 1.2, 0.2);
        this.tone('sine', 220, 70, 1.4, 0.15);
    }

    /** Putting on or taking off clothes and armour. */
    equip(metal: boolean): void {
        this.burst('bandpass', metal ? 2800 : 1400, 0.12, 0.18);

        if (metal) {
            this.tone('sine', 1500, 1480, 0.18, 0.05);
        }
    }

    door(): void {
        this.tone('sawtooth', 160, 120, 0.35, 0.05, 700);
        this.burst('lowpass', 600, 0.1, 0.18);
    }

    chest(): void {
        this.tone('triangle', 260, 200, 0.18, 0.12);
        this.burst('bandpass', 900, 0.08, 0.12);
    }

    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));

        if (this.context && !this.muted) {
            this.master.gain.setTargetAtTime(
                this.volume,
                this.context.currentTime,
                0.05,
            );
        }
    }

    /** Called every frame: blends the background sounds. */
    updateAmbience(ambience: Ambience): void {
        const context = this.context;

        if (!context) {
            return;
        }

        const now = context.currentTime;
        const ease = 0.6;

        this.muffle.frequency.setTargetAtTime(
            ambience.underwater ? 500 : 20000,
            now,
            0.08,
        );
        this.wind.gain.setTargetAtTime(
            0.025 + ambience.windy * 0.09 + ambience.open * 0.02,
            now,
            ease,
        );
        this.windFilter.frequency.setTargetAtTime(
            380 + Math.sin(now * 0.23) * 140 + ambience.windy * 200,
            now,
            ease,
        );
        this.water.gain.setTargetAtTime(ambience.nearWater * 0.12, now, ease);
        this.fireRumble.gain.setTargetAtTime(ambience.fire * 0.08, now, 0.2);

        if (ambience.underwater) {
            return;
        }

        const birds =
            (ambience.forest + ambience.open * 0.6) * (1 - ambience.night);

        if (birds > 0.1 && now > this.nextBird) {
            this.chirp(birds);
            this.nextBird = now + 1.5 + (Math.random() * 5) / birds;
        }

        if (ambience.night > 0.5 && now > this.nextCricket) {
            this.cricket(ambience.night);
            this.nextCricket = now + 0.5 + Math.random() * 0.9;
        }

        if (ambience.fire > 0.05 && now > this.nextCrackle) {
            this.burst(
                'highpass',
                2500 + Math.random() * 2000,
                0.012,
                0.12 * ambience.fire,
                0,
                Math.random() * 2 - 1,
            );
            this.nextCrackle = now + 0.03 + Math.random() * 0.25;
        }
    }

    private chirp(loudness: number): void {
        const context = this.context!;
        const pan = Math.random() * 2 - 1;
        const base = 2400 + Math.random() * 1600;
        const notes = 2 + Math.floor(Math.random() * 4);

        for (let i = 0; i < notes; i++) {
            const start =
                context.currentTime + i * (0.08 + Math.random() * 0.05);
            this.tone(
                'sine',
                base,
                base * (1.2 + Math.random() * 0.4),
                0.06,
                0.035 * Math.min(1, loudness),
                0,
                pan,
                start,
            );
        }
    }

    private cricket(night: number): void {
        const context = this.context!;
        const pan = Math.random() * 2 - 1;

        for (let i = 0; i < 3; i++) {
            this.tone(
                'sine',
                4300,
                4250,
                0.025,
                0.018 * night,
                0,
                pan,
                context.currentTime + i * 0.05,
            );
        }
    }

    /** A looping noise bed through a filter; answers its gain and filter. */
    private loop(
        type: BiquadFilterType,
        frequency: number,
        q: number,
    ): [GainNode, BiquadFilterNode] {
        const context = this.context!;
        const source = context.createBufferSource();
        source.buffer = this.noise;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(this.muffle);
        source.start();

        return [gain, filter];
    }

    private burst(
        type: BiquadFilterType,
        frequency: number,
        duration: number,
        gain: number,
        attack = 0.005,
        pan = 0,
    ): void {
        const context = this.context;

        if (!context || this.muted) {
            return;
        }

        const now = context.currentTime;
        const source = context.createBufferSource();
        source.buffer = this.noise;
        source.playbackRate.value = 0.8 + Math.random() * 0.4;
        const filter = context.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(
            Math.max(0.0002, gain),
            now + attack + 0.001,
        );
        envelope.gain.exponentialRampToValueAtTime(
            0.0001,
            now + attack + duration,
        );
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        source
            .connect(filter)
            .connect(envelope)
            .connect(panner)
            .connect(this.muffle);
        source.start(now, Math.random() * 1.5);
        source.stop(now + attack + duration + 0.05);
    }

    private tone(
        type: OscillatorType,
        from: number,
        to: number,
        duration: number,
        gain: number,
        lowpass = 0,
        pan = 0,
        start?: number,
    ): void {
        const context = this.context;

        if (!context || this.muted) {
            return;
        }

        const now = start ?? context.currentTime;
        const oscillator = context.createOscillator();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(1, to),
            now + duration,
        );
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(
            Math.max(0.0002, gain),
            now + 0.008,
        );
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        let node: AudioNode = oscillator;

        if (lowpass > 0) {
            const filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = lowpass;
            node = node.connect(filter);
        }

        node.connect(envelope).connect(panner).connect(this.muffle);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.05);
    }
}
