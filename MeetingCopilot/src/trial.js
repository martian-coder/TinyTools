'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TRIAL_DAYS = 25;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

function trialFiles() {
    const { app } = require('electron');
    return [
        path.join(app.getPath('userData'), '.trial.json'),
        path.join(os.homedir(), '.meetbrief', '.t'),
    ];
}

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

function getStatus() {
    let installedAt = null;

    for (const fp of trialFiles()) {
        try {
            if (fs.existsSync(fp)) {
                const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
                const ts = data.i || data.installedAt;
                if (ts && (installedAt === null || ts < installedAt)) {
                    installedAt = ts; // always honour the earliest date found
                }
            }
        } catch {}
    }

    if (installedAt === null) {
        initTrial();
        return { active: true, expired: false, daysRemaining: TRIAL_DAYS };
    }

    const elapsed = Date.now() - installedAt;
    const daysRemaining = Math.max(0, Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000)));

    return {
        active: daysRemaining > 0,
        expired: daysRemaining === 0,
        daysRemaining,
    };
}

module.exports = { initTrial, getStatus, TRIAL_DAYS };
