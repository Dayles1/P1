/**
 * Sound from sounds.json: every preset is synthesised with WebAudio from
 * its description, or played from `file` when one is set. Ambience picks
 * random day or night sounds of the era's settlement type.
 */

import type { SoundPreset, SoundsFile } from '../engine/content/types';

export class AudioEngine {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private noise: AudioBuffer | null = null;
    private files = new Map<string, AudioBuffer>();
    private nextAmbient = 0;
    muted = false;

    constructor(private sounds: SoundsFile) {}

    setSounds(sounds: SoundsFile): void {
        this.sounds = sounds;
        this.files.clear();
    }

    /** Browsers only allow audio after a user gesture; call from one. */
    unlock(): void {
        if (this.context) {
            void this.context.resume();

            return;
        }

        try {
            this.context = new AudioContext();
            this.master = this.context.createGain();
            this.master.gain.value = this.sounds.master;
            this.master.connect(this.context.destination);

            const length = this.context.sampleRate;

            this.noise = this.context.createBuffer(
                1,
                length,
                this.context.sampleRate,
            );

            const data = this.noise.getChannelData(0);

            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        } catch {
            this.context = null;
        }
    }

    setMuted(muted: boolean): void {
        this.muted = muted;

        if (this.master) {
            this.master.gain.value = muted ? 0 : this.sounds.master;
        }
    }

    play(id: string | null | undefined, volume = 1): void {
        if (!id || this.muted || !this.context || !this.master) {
            return;
        }

        const preset = this.sounds.presets[id];

        if (!preset) {
            return;
        }

        if (preset.file) {
            void this.playFile(preset.file, preset.synth?.volume ?? 0.5);

            return;
        }

        this.synth(preset, volume);
    }

    /** Called every frame; occasionally plays a background sound. */
    ambience(
        type: string,
        night: boolean,
        weatherSound: string | null,
        now = performance.now() / 1000,
    ): void {
        if (this.muted || !this.context || now < this.nextAmbient) {
            return;
        }

        const set = this.sounds.ambience[type];

        if (!set) {
            return;
        }

        const pool = [
            ...(night ? set.night : set.day),
            ...(weatherSound ? [weatherSound, weatherSound] : []),
        ];

        this.nextAmbient =
            now + set.every[0] + Math.random() * (set.every[1] - set.every[0]);

        if (pool.length) {
            this.play(pool[Math.floor(Math.random() * pool.length)], 0.6);
        }
    }

    private synth(preset: SoundPreset, volume: number): void {
        const ctx = this.context!;
        const s = preset.synth;
        const start = ctx.currentTime;
        const repeat = s.repeat ?? 1;

        for (let r = 0; r < repeat; r++) {
            const at = start + r * (s.gap ?? s.duration);

            if (s.noise && this.noise) {
                const source = ctx.createBufferSource();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();

                source.buffer = this.noise;
                source.loop = true;
                filter.type = 'lowpass';
                filter.frequency.value = s.filter ?? 1000;
                gain.gain.setValueAtTime(0.0001, at);
                gain.gain.exponentialRampToValueAtTime(
                    s.volume * volume,
                    at + Math.min(0.02, s.duration / 4),
                );
                gain.gain.exponentialRampToValueAtTime(0.0001, at + s.duration);
                source.connect(filter).connect(gain).connect(this.master!);
                source.start(at, Math.random());
                source.stop(at + s.duration + 0.05);

                continue;
            }

            const notes = s.notes?.length ? s.notes : [440];
            const step = s.duration;

            notes.forEach((frequency, index) => {
                for (const harmonic of s.harmonics ?? [1]) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const noteStart = at + index * step;
                    let node: AudioNode = osc;

                    osc.type = s.wave ?? 'sine';
                    osc.frequency.value = frequency * harmonic;

                    if (s.filter) {
                        const filter = ctx.createBiquadFilter();

                        filter.type = 'lowpass';
                        filter.frequency.value = s.filter;
                        node = osc.connect(filter);
                    }

                    const level =
                        (s.volume * volume) /
                        (s.harmonics?.length ?? 1) /
                        harmonic;

                    gain.gain.setValueAtTime(0.0001, noteStart);
                    gain.gain.exponentialRampToValueAtTime(
                        Math.max(0.0002, level),
                        noteStart + 0.01,
                    );
                    gain.gain.exponentialRampToValueAtTime(
                        0.0001,
                        noteStart + step * (s.harmonics ? 1 : 0.95),
                    );
                    node.connect(gain).connect(this.master!);
                    osc.start(noteStart);
                    osc.stop(noteStart + step + 0.05);
                }
            });
        }
    }

    private async playFile(url: string, volume: number): Promise<void> {
        const ctx = this.context!;

        try {
            let buffer = this.files.get(url);

            if (!buffer) {
                buffer = await ctx.decodeAudioData(
                    await (await fetch(url)).arrayBuffer(),
                );
                this.files.set(url, buffer);
            }

            const source = ctx.createBufferSource();
            const gain = ctx.createGain();

            source.buffer = buffer;
            gain.gain.value = volume;
            source.connect(gain).connect(this.master!);
            source.start();
        } catch {
            // A missing or broken file stays silent.
        }
    }
}
