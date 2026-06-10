'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const MODEL_URL =
    'https://github.com/snakers4/silero-vad/raw/v5.1.2/src/silero_vad/data/silero_vad.onnx';
const MODEL_FILENAME = 'silero_vad_v5.onnx';

const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 512;
const FRAME_BYTES = FRAME_SAMPLES * 2;
const STATE_SHAPE = [2, 1, 128];
const STATE_SIZE = STATE_SHAPE[0] * STATE_SHAPE[1] * STATE_SHAPE[2]; // 256 floats

function downloadFile(url, destPath, redirectsLeft) {
    if (redirectsLeft === undefined) redirectsLeft = 10;
    return new Promise((resolve, reject) => {
        if (redirectsLeft === 0) {
            return reject(new Error('Too many redirects downloading Silero VAD model'));
        }

        const proto = url.startsWith('https') ? https : http;

        const req = proto.get(url, { timeout: 30000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                downloadFile(res.headers.location, destPath, redirectsLeft - 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(
                    new Error(`HTTP ${res.statusCode} downloading Silero VAD model from ${url}`)
                );
            }

            const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
            let receivedBytes = 0;
            let lastLoggedPct = -1;
            const tmpPath = destPath + '.tmp';

            const file = fs.createWriteStream(tmpPath);

            res.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (totalBytes > 0) {
                    const pct = Math.floor((receivedBytes / totalBytes) * 100);
                    if (pct !== lastLoggedPct && pct % 10 === 0) {
                        console.log(`[SileroVAD] Downloading model... ${pct}%`);
                        lastLoggedPct = pct;
                    }
                }
            });

            res.pipe(file);

            file.on('finish', () => {
                file.close((closeErr) => {
                    if (closeErr) {
                        fs.unlink(tmpPath, () => {});
                        return reject(closeErr);
                    }
                    try {
                        fs.renameSync(tmpPath, destPath);
                    } catch (renameErr) {
                        fs.unlink(tmpPath, () => {});
                        return reject(renameErr);
                    }
                    console.log('[SileroVAD] Model downloaded successfully.');
                    resolve();
                });
            });

            file.on('error', (err) => {
                fs.unlink(tmpPath, () => {});
                reject(err);
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy(new Error('Connection timeout downloading Silero VAD model'));
        });
    });
}

class SileroVAD {
    constructor(session, options) {
        if (!options) options = {};
        this._session = session;
        this.threshold = options.threshold !== undefined ? options.threshold : 0.5;
        this.minSpeechFrames = options.minSpeechFrames !== undefined ? options.minSpeechFrames : 3;
        this.minSilenceFrames =
            options.minSilenceFrames !== undefined ? options.minSilenceFrames : 20;

        // Silero v5 LSTM state: hidden + cell, shape [2,1,128], zeroed at start
        this._state = new Float32Array(STATE_SIZE);

        // The sr input is int64 and stays constant — allocate once
        this._srData = new BigInt64Array([BigInt(SAMPLE_RATE)]);
    }

    static async create(cacheDir, options) {
        if (!options) options = {};
        const ort = require('onnxruntime-node');

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const modelPath = path.join(cacheDir, MODEL_FILENAME);

        if (!fs.existsSync(modelPath)) {
            console.log('[SileroVAD] Model not cached — downloading from GitHub...');
            await downloadFile(MODEL_URL, modelPath);
        } else {
            console.log('[SileroVAD] Using cached model at:', modelPath);
        }

        // intraOpNumThreads/interOpNumThreads = 1 avoids ONNX spawning a thread pool
        // that conflicts with Electron's main-process IPC loop.
        const session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ['cpu'],
            intraOpNumThreads: 1,
            interOpNumThreads: 1,
        });

        return new SileroVAD(session, options);
    }

    reset() {
        this._state.fill(0);
    }

    async processFrame(pcm16Buffer) {
        if (!Buffer.isBuffer(pcm16Buffer) || pcm16Buffer.length !== FRAME_BYTES) {
            throw new Error(
                `SileroVAD.processFrame requires exactly ${FRAME_BYTES} bytes ` +
                    `(512 Int16LE samples); received ${pcm16Buffer ? pcm16Buffer.length : 'null'}`
            );
        }

        const ort = require('onnxruntime-node');

        // Normalise Int16LE PCM → float32 in [-1, 1]
        const float32 = new Float32Array(FRAME_SAMPLES);
        for (let i = 0; i < FRAME_SAMPLES; i++) {
            float32[i] = pcm16Buffer.readInt16LE(i * 2) / 32768.0;
        }

        const inputTensor = new ort.Tensor('float32', float32, [1, FRAME_SAMPLES]);
        const stateTensor = new ort.Tensor('float32', this._state.slice(), STATE_SHAPE);
        const srTensor = new ort.Tensor('int64', this._srData, [1]);

        const results = await this._session.run({
            input: inputTensor,
            state: stateTensor,
            sr: srTensor,
        });

        const stateN = results['stateN'];
        if (!stateN) {
            throw new Error(
                '[SileroVAD] Inference did not return "stateN" — verify model version matches v5 spec'
            );
        }
        // Persist LSTM state for the next frame
        this._state.set(stateN.data);

        const output = results['output'];
        if (!output) {
            throw new Error('[SileroVAD] Inference did not return "output"');
        }

        return output.data[0];
    }
}

module.exports = SileroVAD;
