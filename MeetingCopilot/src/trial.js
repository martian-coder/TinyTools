'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TRIAL_DAYS = 25;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const _LS = 'mb_k9x2_v1'; // license secret

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

function validateLicense(key) {
    const m = String(key).trim().toUpperCase()
        .match(/^MEET-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/);
    if (!m) return false;
    const expected = crypto.createHmac('sha256', _LS)
        .update(m[1] + m[2])
        .digest('hex').slice(0, 4).toUpperCase();
    return m[3] === expected;
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
