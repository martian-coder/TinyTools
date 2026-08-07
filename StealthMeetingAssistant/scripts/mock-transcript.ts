/**
 * Feed a scripted meeting into the running backend, paced like real speech.
 * Stands in for a live STT bridge until one is wired up.
 *
 *   npm run mock-transcript            # default pacing
 *   npm run mock-transcript -- --fast  # no delays
 */
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT ?? '5173';
const BASE = process.env.ASSISTANT_URL ?? `http://127.0.0.1:${PORT}`;

function token(): string {
  if (process.env.ASSISTANT_TOKEN) return process.env.ASSISTANT_TOKEN;
  const file = path.resolve(__dirname, '..', 'data', 'session-token.txt');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    console.error(`No token found. Start the backend first, or set ASSISTANT_TOKEN.`);
    process.exit(1);
  }
}

const LINES: [string, string][] = [
  ['Priya', 'Alright, checkout revamp. Dan, where are we?'],
  ['Dan', 'Backend is done apart from the payment retry path, which slips to Sprint 34.'],
  ['Priya', 'Is that a launch blocker?'],
  ['Dan', 'No, but the client timeout is still wrong and that one is.'],
  ['Maya', 'Wrong how? I thought we settled this in the design review.'],
  ['Dan', 'The client is still at ten seconds. The gateway takes up to eleven at month end.'],
  ['Priya', 'What did we actually decide about the API timeout?'],
  ['Maya', 'Fifteen seconds with two retries. It is in the spec.'],
  ['Dan', 'Then I will fix the config this sprint. Should be a one line change.'],
  ['Priya', 'Maya, can you rerun the load test with the new value?'],
  ['Maya', 'Yes. I will post results Wednesday, before the Thursday review.'],
  ['Dan', 'One thing nobody has picked up, we need idempotency keys on the retry path.'],
  ['Maya', 'Otherwise a retry during settlement double charges. That is a real risk.'],
  ['Priya', 'Add it to the sprint. Last item, the vendor contract is still unsigned.'],
  ['Priya', 'If that lapses we lose sandbox first and production thirty days later.'],
];

async function main(): Promise<void> {
  const fast = process.argv.includes('--fast');
  const auth = token();
  console.log(`Streaming ${LINES.length} lines to ${BASE}${fast ? ' (fast)' : ''}`);

  for (const [speaker, text] of LINES) {
    const res = await fetch(`${BASE}/api/session/transcript`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-assistant-token': auth },
      body: JSON.stringify({ speaker, text, isFinal: true, timestamp: Date.now() }),
    });
    if (!res.ok) {
      console.error(`Failed (${res.status}): ${await res.text()}`);
      process.exit(1);
    }
    console.log(`  ${speaker}: ${text}`);
    if (!fast) await sleep(1200 + text.length * 25);
  }
  console.log('\nDone. Try Ctrl+Shift+S (summarize) or Ctrl+Shift+A (action items).');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
