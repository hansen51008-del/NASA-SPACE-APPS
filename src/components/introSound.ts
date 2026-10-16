// A short, locally synthesized fire whoosh; no audio downloads or credentials.
export function scheduleIntroSound(context: BaseAudioContext, at: number) {
  const duration = 1.05;
  const noise = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const samples = noise.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < samples.length; i++) {
    previous = previous * 0.85 + (Math.random() * 2 - 1) * 0.15;
    samples[i] = previous * 2;
  }
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.6;
  filter.frequency.setValueAtTime(650, at);
  filter.frequency.exponentialRampToValueAtTime(2400, at + 0.32);
  filter.frequency.exponentialRampToValueAtTime(280, at + duration);
  const volume = context.createGain();
  volume.gain.setValueAtTime(0, at);
  volume.gain.linearRampToValueAtTime(0.18, at + 0.32);
  volume.gain.exponentialRampToValueAtTime(0.045, at + 0.55);
  volume.gain.exponentialRampToValueAtTime(0.001, at + duration - 0.02);
  volume.gain.linearRampToValueAtTime(0, at + duration);
  source.connect(filter).connect(volume).connect(context.destination);
  source.start(at);
  source.stop(at + duration);

  const rumble = context.createOscillator();
  const rumbleVolume = context.createGain();
  rumble.type = "sine";
  rumble.frequency.setValueAtTime(100, at + 0.25);
  rumble.frequency.exponentialRampToValueAtTime(42, at + 0.65);
  rumbleVolume.gain.setValueAtTime(0, at);
  rumbleVolume.gain.setValueAtTime(0, at + 0.25);
  rumbleVolume.gain.linearRampToValueAtTime(0.07, at + 0.3);
  rumbleVolume.gain.exponentialRampToValueAtTime(0.001, at + 0.8);
  rumbleVolume.gain.linearRampToValueAtTime(0, at + 0.85);
  rumble.connect(rumbleVolume).connect(context.destination);
  rumble.start(at + 0.25);
  rumble.stop(at + 0.85);
}

export function startIntroSound() {
  let context: AudioContext;
  try {
    context = new AudioContext();
  } catch {
    return () => {};
  }
  const startedAt = performance.now();
  let disposed = false;
  let scheduled = false;

  function play() {
    const elapsed = (performance.now() - startedAt) / 1000;
    if (disposed || scheduled || context.state !== "running" || elapsed > 0.9)
      return;
    scheduled = true;
    scheduleIntroSound(
      context,
      context.currentTime + Math.max(0, 0.3 - elapsed),
    );
  }
  function unlock(event: Event) {
    if (event instanceof KeyboardEvent && event.key === "Escape") return;
    if (disposed || scheduled || performance.now() - startedAt > 900) return;
    void context
      .resume()
      .then(play)
      .catch(() => {});
  }
  // Respect autoplay policy: a suspended context waits for a real interaction.
  play();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  return () => {
    disposed = true;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    if (context.state !== "closed") void context.close().catch(() => {});
  };
}
