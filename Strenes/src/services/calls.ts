/**
 * calls — real voice calling between two Strenes users over WebRTC.
 *
 * Signaling rides the existing message relay: offers/answers/hangups travel
 * as JSON envelopes through the same Supabase/Firebase pipe as chat messages,
 * are intercepted in App.tsx BEFORE moderation, and never appear in a chat.
 * Audio itself flows peer-to-peer (STUN only — no media server), so voice
 * never touches our backend at all.
 *
 * The relay polls every ~2s, so ICE is gathered non-trickle (one offer, one
 * answer, complete candidates) to keep call setup to two relay hops.
 */

import { sendMessage as relaySend } from './backend';
import { useSiftStore } from '../store';

const SIGNAL_TAG = '__strenes_call';

export interface CallSignal {
  kind: 'offer' | 'answer' | 'hangup';
  sdp?: string;
  reason?: 'declined' | 'busy' | 'ended' | 'timeout';
}

/** Cheap pre-check so normal chat texts skip JSON parsing. */
export function looksLikeCallSignal(text: string): boolean {
  return text.startsWith('{') && text.includes(`"${SIGNAL_TAG}"`);
}

export function parseCallSignal(text: string): CallSignal | null {
  if (!looksLikeCallSignal(text)) return null;
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const sig = obj[SIGNAL_TAG] as CallSignal | undefined;
    if (!sig || typeof sig.kind !== 'string') return null;
    return sig;
  } catch {
    return null;
  }
}

// ——— Module state ————————————————————————————————————————————————————————

let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteAudio: HTMLAudioElement | null = null;
let myId: string | null = null;
let peerId: string | null = null;
let pendingOffer: { from: string; sdp: string } | null = null;
let ringTimer: ReturnType<typeof setTimeout> | null = null;

function sendSignal(to: string, sig: CallSignal) {
  if (!myId) return;
  relaySend(myId, to, JSON.stringify({ [SIGNAL_TAG]: sig })).catch(err =>
    console.error('Call signal failed:', err));
}

function setCall(call: { peerId: string; direction: 'in' | 'out'; status: 'ringing' | 'incoming' | 'connected'; startedAt?: number } | null) {
  useSiftStore.getState().setActiveCall(call);
}

function teardown() {
  if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
  try { pc?.close(); } catch { /* already closed */ }
  pc = null;
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  if (remoteAudio) {
    remoteAudio.srcObject = null;
    remoteAudio.remove();
    remoteAudio = null;
  }
  peerId = null;
  pendingOffer = null;
  setCall(null);
}

async function createPeer(otherId: string, direction: 'in' | 'out'): Promise<RTCPeerConnection> {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const conn = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });
  localStream.getTracks().forEach(t => conn.addTrack(t, localStream!));

  conn.ontrack = (e) => {
    if (!remoteAudio) {
      remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      document.body.appendChild(remoteAudio);
    }
    remoteAudio.srcObject = e.streams[0];
  };

  conn.onconnectionstatechange = () => {
    if (conn.connectionState === 'connected') {
      if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
      setCall({ peerId: otherId, direction, status: 'connected', startedAt: Date.now() });
    } else if (['failed', 'closed'].includes(conn.connectionState)) {
      teardown();
    }
  };

  pc = conn;
  peerId = otherId;
  return conn;
}

/** Resolve when ICE gathering finishes so one signal carries all candidates. */
function iceComplete(conn: RTCPeerConnection): Promise<void> {
  if (conn.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { conn.removeEventListener('icegatheringstatechange', check); resolve(); };
    const check = () => { if (conn.iceGatheringState === 'complete') done(); };
    conn.addEventListener('icegatheringstatechange', check);
    setTimeout(done, 4000); // don't stall forever on odd networks
  });
}

// ——— Public API ——————————————————————————————————————————————————————————

export async function startCall(selfId: string, otherId: string): Promise<void> {
  if (useSiftStore.getState().activeCall) return;
  myId = selfId;
  const conn = await createPeer(otherId, 'out');
  setCall({ peerId: otherId, direction: 'out', status: 'ringing' });

  const offer = await conn.createOffer();
  await conn.setLocalDescription(offer);
  await iceComplete(conn);
  sendSignal(otherId, { kind: 'offer', sdp: conn.localDescription!.sdp });

  // Give up if nobody answers.
  ringTimer = setTimeout(() => {
    sendSignal(otherId, { kind: 'hangup', reason: 'timeout' });
    teardown();
  }, 45_000);
}

/** Feed every relay signal here (App.tsx intercepts them before moderation). */
export async function handleCallSignal(selfId: string, fromId: string, sig: CallSignal): Promise<void> {
  myId = selfId;

  if (sig.kind === 'offer') {
    if (useSiftStore.getState().activeCall || !sig.sdp) {
      sendSignal(fromId, { kind: 'hangup', reason: 'busy' });
      return;
    }
    pendingOffer = { from: fromId, sdp: sig.sdp };
    setCall({ peerId: fromId, direction: 'in', status: 'incoming' });
    return;
  }

  if (sig.kind === 'answer') {
    if (pc && sig.sdp && fromId === peerId) {
      try {
        await pc.setRemoteDescription({ type: 'answer', sdp: sig.sdp });
      } catch (err) {
        console.error('Failed to apply answer:', err);
        teardown();
      }
    }
    return;
  }

  // hangup / decline / busy / timeout from the other side
  if (fromId === peerId || fromId === pendingOffer?.from) {
    teardown();
  }
}

export async function acceptCall(selfId: string): Promise<void> {
  const offer = pendingOffer;
  if (!offer) return;
  myId = selfId;
  pendingOffer = null;

  try {
    const conn = await createPeer(offer.from, 'in');
    await conn.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);
    await iceComplete(conn);
    sendSignal(offer.from, { kind: 'answer', sdp: conn.localDescription!.sdp });
    // Status flips to 'connected' via onconnectionstatechange.
  } catch (err) {
    console.error('Failed to accept call:', err);
    sendSignal(offer.from, { kind: 'hangup', reason: 'ended' });
    teardown();
  }
}

export function declineCall(selfId: string): void {
  myId = selfId;
  if (pendingOffer) sendSignal(pendingOffer.from, { kind: 'hangup', reason: 'declined' });
  teardown();
}

export function endCall(): void {
  if (peerId) sendSignal(peerId, { kind: 'hangup', reason: 'ended' });
  teardown();
}

export function setCallMuted(muted: boolean): void {
  localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
}
