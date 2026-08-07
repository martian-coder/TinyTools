/**
 * Captures real screenshots of the overlay using Electron's own
 * webContents.capturePage(), driven through the actual UI with a mock LLM and
 * a mock speech engine. Nothing here is mocked up in a design tool — it is the
 * shipping renderer, rendering real streamed output.
 *
 *   xvfb-run -a electron scripts/screenshot.js
 */
const { app } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const OUT = path.join(process.cwd(), 'docs', 'screenshots');
const DATA = '/tmp/sma-shots';
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

process.env.DATA_DIR = DATA;
process.env.EMBEDDINGS_MODE = 'hash';
process.env.DEFAULT_PROVIDER = 'custom';
process.env.CUSTOM_LLM_MODEL = 'gpt-4o-mini';
process.env.CUSTOM_LLM_API_KEY = 'demo';
process.env.DEEPGRAM_API_KEY = 'demo';

/** A realistic executive-mode answer, streamed token by token. */
const ANSWER =
  '**Two live risks.**\n\n' +
  '- **Vendor contract unsigned** — sandbox access lapses first, production 30 days later ' +
  '[org-priorities.csv, rows 1-8]\n' +
  '- **Load test never run** at the 15s timeout; the numbers in the spec are modelled, ' +
  'not measured [project-spec.md, Known gaps]\n\n' +
  '**Open question from the discussion:** nobody owns the rollback runbook.\n\n' +
  'Suggestion: get Priya a signature date before Thursday.';

const REPLY =
  '**Say:** "Fifteen seconds with two retries — that was the call in the design ' +
  'review, and it is in the spec [project-spec.md, Timeouts and retries]. Dan is ' +
  'fixing the client config this sprint."\n\n' +
  '**Or softer:** "I think we landed on fifteen, but let me confirm against the spec ' +
  'before anyone codes to it."\n\n' +
  'Worth adding: the load test has never been run at that value.';

const llm = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.url.includes('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }));
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    // The suggest-reply action gets a reply-shaped answer, so the auto-suggest
    // capture shows what that mode really produces.
    const parsed = JSON.parse(body || '{}');
    const wantsReply = /Suggest a short professional reply/.test(
      parsed.messages?.at(-1)?.content ?? '',
    );
    const text = wantsReply ? REPLY : ANSWER;
    // Stream in word-sized pieces so the capture shows real streamed output.
    const pieces = text.match(/\S+\s*/g) ?? [text];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= pieces.length) {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: pieces[i++] } }] })}\n\n`);
    }, 8);
  });
});

/** Mock speech engine so the listening indicator reflects a real session. */
const stt = http.createServer();
new WebSocketServer({ server: stt }).on('connection', (socket) => {
  socket.on('message', (d, isBinary) => {
    if (!isBinary) return;
  });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

llm.listen(0, '127.0.0.1', () => {
  process.env.CUSTOM_LLM_BASE_URL = `http://127.0.0.1:${llm.address().port}/v1`;
  stt.listen(0, '127.0.0.1', () => {
    process.env.DEEPGRAM_BASE_URL = `ws://127.0.0.1:${stt.address().port}`;
    require(path.join(process.cwd(), 'dist/electron/main.js'));
  });
});

const MEETING = [
  ['Priya', 'Alright, checkout revamp. Dan, where are we?'],
  ['Dan', 'Backend is done apart from the payment retry path, which slips to Sprint 34.'],
  ['Maya', 'Fifteen seconds with two retries. It is in the spec.'],
  ['Dan', 'Then I will fix the config this sprint.'],
  ['Priya', 'Last item, the vendor contract is still unsigned.'],
];

app.whenReady().then(() =>
  setTimeout(async () => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getAllWindows()[0];
    const js = (s) => win.webContents.executeJavaScript(s);

    const shot = async (name) => {
      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(OUT, `${name}.png`), image.toPNG());
      console.log(`captured ${name}.png`);
    };

    // Index the sample documents through the real upload path.
    const files = ['meeting-notes.md', 'project-spec.md', 'org-priorities.csv'].map((n) => ({
      name: n,
      text: fs.readFileSync(path.join('samples', n), 'utf8'),
    }));
    await js(`(async () => {
      const files = ${JSON.stringify(files)};
      const form = new FormData();
      for (const f of files) form.append('files', new Blob([f.text]), f.name);
      await fetch(location.origin + '/api/documents/upload', {
        method: 'POST', headers: { 'x-assistant-token': new URLSearchParams(location.search).get('token') },
        body: form,
      });
    })()`);

    // Push the meeting transcript in.
    await js(`(async () => {
      const events = ${JSON.stringify(MEETING)}.map(([speaker, text], i) => ({
        speaker, text, isFinal: true, timestamp: Date.now() - (5 - i) * 24000,
      }));
      await fetch(location.origin + '/api/session/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json',
                   'x-assistant-token': new URLSearchParams(location.search).get('token') },
        body: JSON.stringify({ events }),
      });
    })()`);

    // Start listening with a synthetic stream so the meters are genuinely live.
    await js(`(async () => {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const osc = ctx.createOscillator(); osc.frequency.value = 300;
      const gain = ctx.createGain(); gain.gain.value = 0.35;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain); gain.connect(dest); osc.start();
      navigator.mediaDevices.getUserMedia = async () => dest.stream;
      document.getElementById('btnMic').click();
      await new Promise(r => setTimeout(r, 2500));
    })()`);

    await wait(600);

    // Ask the question and let it stream, capturing mid-stream and complete.
    js(`(() => {
      document.getElementById('input').value = 'What are the current project risks?';
      document.getElementById('btnSend').click();
    })()`);
    await wait(420);
    await shot('01-streaming');

    await wait(2400);
    await shot('02-answer-with-citations');

    // Expand a citation to show the exact chunk the model was given.
    await js(`document.querySelectorAll('.source')[1]?.click()`);
    await wait(400);
    await shot('03-citation-expanded');

    // Auto-suggest: someone else asks a question and the reply drafts itself.
    await js(`(async () => {
      document.getElementById('autoSuggest').checked = true;
      document.getElementById('input').value = '';
      await fetch(location.origin + '/api/session/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json',
                   'x-assistant-token': new URLSearchParams(location.search).get('token') },
        body: JSON.stringify({ speaker: 'Meeting',
          text: 'So what did we actually decide about the API timeout?',
          isFinal: true, timestamp: Date.now() }),
      });
    })()`);
    await wait(4200);
    await shot('04-auto-suggested-reply');

    await js(`document.getElementById('btnDocs').click()`);
    await wait(500);
    await shot('05-documents');

    await js(`(() => { document.getElementById('panelDocs').hidden = true;
                       document.getElementById('btnListen').click(); })()`);
    await wait(900);
    await shot('06-audio-panel');

    await js(`(() => { document.getElementById('panelAudio').hidden = true;
                       document.getElementById('providerChip').click(); })()`);
    await wait(500);
    await shot('07-provider-switcher');

    console.log('done');
    app.exit(0);
  }, 6000),
);
