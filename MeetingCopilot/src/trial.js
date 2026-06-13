'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TRIAL_DAYS = 25;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
// License signing secret. Sourced from the environment at build/run time so it
// isn't a fixed string baked into every shipped copy; the fallback exists only
// for local dev. (Client-side validation is inherently best-effort — a longer
// HMAC raises the brute-force cost but can't be unbreakable on the client.)
const _LS = process.env.MEETBRIEF_LICENSE_SECRET || 'mb_k9x2_v1';

// ── File paths ────────────────────────────────────────────────────────────────

function trialFiles() {
    const { app } = require('electron');
    return [
        path.join(app.getPath('userData'), '.trial.json'),
        path.join(os.homedir(), '.meetbrief', '.t'),
    ];
}

function licenseFile() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), '.license.json');
}

// ── Trial ─────────────────────────────────────────────────────────────────────

function initTrial() {
    const now = Date.now();
    for (const fp of trialFiles()) {
        if (!fs.existsSync(fp)) {
            try {
                fs.mkdirSync(path.dirname(fp), { recursive: true });
                fs.writeFileSync(fp, JSON.stringify({ i: now }), 'utf8');
            } catch {}
        }
    }
}

// ── License ───────────────────────────────────────────────────────────────────

// Constant-time hex comparison so validation timing doesn't leak the MAC.
function safeHexEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false;
    }
}

function hmacHex(data, hexChars) {
    return crypto.createHmac('sha256', _LS).update(data).digest('hex').slice(0, hexChars).toUpperCase();
}

function validateLicense(key) {
    const k = String(key).trim().toUpperCase();

    // Current format: MEET-IIII-IIII-MMMM-MMMM — 32-bit id + 32-bit HMAC.
    const m2 = k.match(/^MEET-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/);
    if (m2) {
        const id = m2[1] + m2[2];
        const mac = m2[3] + m2[4];
        return safeHexEqual(mac, hmacHex('MEETBRIEF-LICENSE-V2|' + id, 8));
    }

    // Legacy format: MEET-IIII-IIII-MMMM — 16-bit HMAC, still accepted.
    const m1 = k.match(/^MEET-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/);
    if (m1) {
        return safeHexEqual(m1[3], hmacHex(m1[1] + m1[2], 4));
    }

    return false;
}

function hasLicense() {
    try {
        const fp = licenseFile();
        if (!fs.existsSync(fp)) return false;
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        return !!(data.key && validateLicense(data.key));
    } catch {
        return false;
    }
}

function activateLicense(key) {
    if (!validateLicense(key)) return false;
    try {
        fs.writeFileSync(
            licenseFile(),
            JSON.stringify({ key: String(key).trim().toUpperCase(), activatedAt: Date.now() }),
            'utf8'
        );
        return true;
    } catch {
        return false;
    }
}

// ── Status (used by main process + renderer via IPC) ──────────────────────────

function getStatus() {
    if (hasLicense()) {
        return { active: true, expired: false, daysRemaining: 999, licensed: true };
    }

    let installedAt = null;
    for (const fp of trialFiles()) {
        try {
            if (fs.existsSync(fp)) {
                const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
                const ts = data.i || data.installedAt;
                if (ts && (installedAt === null || ts < installedAt)) {
                    installedAt = ts;
                }
            }
        } catch {}
    }

    if (installedAt === null) {
        initTrial();
        return { active: true, expired: false, daysRemaining: TRIAL_DAYS, licensed: false };
    }

    const elapsed = Date.now() - installedAt;
    const daysRemaining = Math.max(0, Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000)));

    return {
        active: daysRemaining > 0,
        expired: daysRemaining === 0,
        daysRemaining,
        licensed: false,
    };
}

module.exports = { initTrial, getStatus, activateLicense, validateLicense, TRIAL_DAYS };
