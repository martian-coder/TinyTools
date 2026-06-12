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

async function downloadModel(destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(MODEL_URL, res => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                file.close();
                fs.unlinkSync(destPath);
                https.get(res.headers.location, res2 => {
                    res2.pipe(file);
                    file.on('finish', () => file.close(resolve));
                }).on('error', reject);
                return;
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', err => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
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

    // Synchronous wrapper using cached last result — call isVoicedAsync externally
    isVoiced(frame) {
        return this._lastResult ?? false;
    }

    async processFrame(frame) {
        this._lastResult = await this.isVoicedAsync(frame);
        return this._lastResult;
    }
}

module.exports = { SileroVAD, getModelPath };
