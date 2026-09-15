/**
 * A short two-tone "ding" synthesized with the Web Audio API rather than a
 * shipped audio file — no asset to license/host, nothing to fetch, and the
 * bundle stays exactly as small as it was before this existed.
 */
let audioCtx = null;

export function playNotificationSound() {
    try {
        audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        oscillator.connect(gain).connect(audioCtx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.24);
    } catch {
        // Autoplay policy (no user gesture yet) or an unsupported browser — skip silently, never throw over a nice-to-have.
    }
}
