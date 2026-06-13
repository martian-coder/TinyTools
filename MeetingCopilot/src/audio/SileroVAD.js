const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

const MODEL_URL = 'https://github.com/snakers4/silero-vad/raw/v5.1.2/src/silero_vad/data/silero_vad.onnx';
const MODEL_FILENAME = 'silero_vad_v5.onnx';

function getModelPath() {
    const dir = path.join(os.homedir(), '.cache', 'meetbrief');
    return path.join(dir, MODEL_FILENAME);
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
// Silero v5 ONNX is ~2.2 MB; anything much smaller is an error/redirect page.
const MIN_MODEL_BYTES = 1024 * 1024;

// Follows the full GitHub redirect chain (github.com → CDN → object store).
// The original single-hop handler wrote the second redirect's HTML body into
// the model file, corrupting it and crashing onnxruntime on first run.
function fetchFollowingRedirects(url, file, redirectsLeft, resolve, reject) {
    https.get(url, res => {
        if (REDIRECT_CODES.has(res.statusCode)) {
            res.resume(); // drain so the socket can be reused
            if (redirectsLeft <= 0) return reject(new Error('Too many redirects while downloading Silero VAD model'));
            if (!res.headers.location) return reject(new Error('Redirect response missing Location header'));
            const next = new URL(res.headers.location, url).toString();
            return fetchFollowingRedirects(next, file, redirectsLeft - 1, resolve, reject);
        }
        if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Model download failed: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
    }).on('error', reject);
}

async function downloadModel(destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        file.on('error', err => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
        fetchFollowingRedirects(MODEL_URL, file, MAX_REDIRECTS, resolve, err => {
            file.close(() => fs.unlink(destPath, () => {}));
            reject(err);
        });
    });

    // Guard against a truncated or HTML-redirect body being saved as the model.
    const { size } = fs.statSync(destPath);
    if (size < MIN_MODEL_BYTES) {
        fs.unlinkSync(destPath);
        throw new Error(`Downloaded Silero model is too small (${size} bytes) — download likely failed`);
    }
}

class SileroVAD {
    constructor(options = {}) {
        this._session = null;
        this._threshold = options.threshold ?? 0.5;
        this._minSpeechFrames = options.minSpeechFrames ?? 3;
        this._minSilenceFrames = options.minSilenceFrames ?? 20;
        // LSTM state (batch=1, layers=2, hidden=64)
        this._h = null;
        this._c = null;
        this._speechFrames = 0;
        this._silenceFrames = 0;
    }

    async load() {
        const { InferenceSession, Tensor } = require('onnxruntime-node');
        const modelPath = getModelPath();

        if (!fs.existsSync(modelPath)) {
            console.log('[SileroVAD] Downloading model...');
            await downloadModel(modelPath);
            console.log('[SileroVAD] Model downloaded.');
        }

        this._session = await InferenceSession.create(modelPath);
        this._resetState();
        console.log('[SileroVAD] Model loaded.');
    }

    _resetState() {
        const { Tensor } = require('onnxruntime-node');
        this._h = new Tensor('float32', new Float32Array(2 * 1 * 64), [2, 1, 64]);
        this._c = new Tensor('float32', new Float32Array(2 * 1 * 64), [2, 1, 64]);
    }

    // frame: Buffer of exactly 1024 bytes (512 Int16LE samples at 16kHz)
    async isVoicedAsync(frame) {
        if (!this._session) throw new Error('SileroVAD not loaded — call load() first');
        const { Tensor } = require('onnxruntime-node');

        const samples = new Float32Array(512);
        for (let i = 0; i < 512; i++) {
            samples[i] = frame.readInt16LE(i * 2) / 32768.0;
        }

        const input = new Tensor('float32', samples, [1, 512]);
        const srTensor = new Tensor('int64', BigInt64Array.from([16000n]), [1]);

        const feeds = { input, sr: srTensor, h: this._h, c: this._c };
        const results = await this._session.run(feeds);

        this._h = results.hn;
        this._c = results.cn;

        const prob = results.output.data[0];
        return prob >= this._threshold;
    }
}

module.exports = { SileroVAD, getModelPath };
