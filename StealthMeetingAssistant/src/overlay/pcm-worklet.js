/**
 * Converts Float32 audio to signed 16-bit PCM and posts it to the main thread.
 *
 * The AudioContext is created at 16 kHz, so the browser has already resampled
 * for us — this worklet only has to change the sample format and batch frames
 * into chunks big enough to be worth a WebSocket send.
 */
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    // 128-sample render quanta are far too small to send individually;
    // 2048 samples is 128 ms at 16 kHz, a good latency/overhead balance.
    this.target = 2048;
    this.buffer = new Int16Array(this.target);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      if (sample > peak) peak = sample;
      else if (-sample > peak) peak = -sample;

      // Asymmetric scaling: int16 range is -32768..32767.
      this.buffer[this.offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      if (this.offset === this.target) {
        // Transfer the buffer instead of copying it.
        const chunk = this.buffer.slice();
        this.port.postMessage({ pcm: chunk.buffer, peak }, [chunk.buffer]);
        this.offset = 0;
        peak = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-worklet', PcmWorklet);
