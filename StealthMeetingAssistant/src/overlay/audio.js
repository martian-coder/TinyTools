/**
 * Audio capture for the overlay.
 *
 * Two independent sources — your microphone and the meeting's system audio —
 * each get their own AudioContext, their own WebSocket and their own STT
 * session, so every transcript line keeps a correct speaker label. Mixing
 * them into one stream would make "who said this" unrecoverable.
 *
 * Everything downstream expects 16 kHz mono PCM16, which is what leaves here.
 */

(() => {
  'use strict';

  const SAMPLE_RATE = 16000;

  class SourceCapture {
    constructor(source, options) {
      this.source = source;
      this.options = options; // { baseUrl, token, onLevel, onState, onError }
      this.stream = null;
      this.context = null;
      this.node = null;
      this.socket = null;
      this.running = false;
    }

    async start(mediaStream) {
      await this.stop();
      this.stream = mediaStream;

      // Asking for 16 kHz directly lets the browser resample with a proper
      // filter — far better than decimating by hand in the worklet.
      this.context = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (this.context.state === 'suspended') await this.context.resume();

      await this.context.audioWorklet.addModule('pcm-worklet.js');

      const input = this.context.createMediaStreamSource(mediaStream);
      this.node = new AudioWorkletNode(this.context, 'pcm-worklet', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        // Mixing every channel down to mono, rather than picking channel 0,
        // means a stereo meeting feed does not lose one side of the call.
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      });

      await this.openSocket();

      this.node.port.onmessage = (event) => {
        const { pcm, peak } = event.data;
        this.options.onLevel?.(this.source, peak);
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(pcm);
      };

      input.connect(this.node);
      // No connection to destination: we must never play the meeting audio
      // back out of the speakers, which would echo into the call.

      this.running = true;
      this.options.onState?.(this.source, true);

      // If the OS or the user revokes the device, stop cleanly.
      for (const track of mediaStream.getTracks()) {
        track.addEventListener('ended', () => this.stop());
      }
    }

    openSocket() {
      return new Promise((resolve, reject) => {
        const base = this.options.baseUrl.replace(/^http/, 'ws');
        const url = `${base}/ws/audio?source=${this.source}&token=${encodeURIComponent(this.options.token)}`;
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';

        const timer = setTimeout(() => reject(new Error('Audio socket timed out')), 8000);
        this.socket.onopen = () => {
          clearTimeout(timer);
          resolve();
        };
        this.socket.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Could not open the audio socket'));
        };
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // The backend lost its STT session; stop rather than shout into a void.
            if (data.type === 'inactive') this.stop();
          } catch {
            /* ignore */
          }
        };
        this.socket.onclose = () => {
          if (this.running) this.stop();
        };
      });
    }

    async stop() {
      this.running = false;
      if (this.node) {
        this.node.port.onmessage = null;
        this.node.disconnect();
        this.node = null;
      }
      if (this.context) {
        await this.context.close().catch(() => undefined);
        this.context = null;
      }
      if (this.stream) {
        for (const track of this.stream.getTracks()) track.stop();
        this.stream = null;
      }
      if (this.socket) {
        const socket = this.socket;
        this.socket = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN) socket.close();
      }
      this.options.onState?.(this.source, false);
      this.options.onLevel?.(this.source, 0);
    }
  }

  /** Public surface used by app.js. */
  class AudioCapture {
    constructor(options) {
      this.options = options;
      this.mic = new SourceCapture('mic', options);
      this.system = new SourceCapture('system', options);
    }

    isActive(source) {
      return this[source]?.running ?? false;
    }

    /** Microphone. Plain getUserMedia with the meeting-friendly processing on. */
    async startMic(deviceId) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      await this.mic.start(stream);
    }

    /**
     * System audio — the other participants. Three different mechanisms
     * depending on the OS; see the README table.
     *
     * `method` comes from the backend so the renderer does not have to guess
     * the platform.
     */
    async startSystem(method, deviceId) {
      let stream;

      if (method === 'screencapturekit') {
        // macOS native: the Electron main process runs the helper and pipes
        // PCM straight into the backend, so the renderer captures nothing.
        // It only marks the source active so the UI reflects reality.
        const result = await window.overlay.startSystemAudio();
        if (!result?.ok) throw new Error(result?.error ?? 'Native audio capture failed');
        this.system.running = true;
        this.options.onState?.('system', true);
        return;
      }

      if (method === 'loopback') {
        // Windows: Electron's display-media handler substitutes WASAPI
        // loopback for us. Video is requested because getDisplayMedia
        // requires it, then dropped immediately.
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        for (const track of stream.getVideoTracks()) {
          track.stop();
          stream.removeTrack(track);
        }
        if (!stream.getAudioTracks().length) {
          throw new Error('No system audio track was returned. Loopback may be unavailable.');
        }
      } else {
        // macOS / Linux: the "system audio" is an input device — a PulseAudio
        // .monitor source or a virtual cable like BlackHole.
        if (!deviceId) {
          throw new Error('Pick a system audio input device first');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            // Never process the remote audio: echo cancellation and noise
            // suppression are tuned for a live mic and mangle a clean feed.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
      }

      await this.system.start(stream);
    }

    async stop(source) {
      // The native helper lives in the main process; stopping it is an IPC
      // call rather than tearing down a MediaStream.
      const stopNative = async (which) => {
        if (which !== 'system') return;
        if (!window.overlay?.stopSystemAudio) return;
        await window.overlay.stopSystemAudio().catch(() => undefined);
        this.system.running = false;
        this.options.onState?.('system', false);
      };

      if (source) {
        await stopNative(source);
        return this[source].stop();
      }
      await stopNative('system');
      await Promise.all([this.mic.stop(), this.system.stop()]);
    }

    /**
     * Input devices, with the ones that look like system-audio sources
     * flagged. Labels are only populated after permission has been granted
     * once, which is why the UI asks for the mic before listing.
     */
    static async listInputDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || 'Unnamed input',
          likelySystemAudio: AudioCapture.looksLikeSystemAudio(d.label),
        }));
    }

    /** Recognises the usual loopback/virtual-cable device names. */
    static looksLikeSystemAudio(label) {
      return /monitor|loopback|blackhole|soundflower|vb-?cable|vb-?audio|stereo mix|what ?u ?hear|virtual/i.test(
        label ?? '',
      );
    }
  }

  window.AudioCapture = AudioCapture;
})();
