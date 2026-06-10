'use strict';

const fs = require('fs');
const path = require('path');

const TRIAL_DAYS = 25;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

function trialFile() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), '.trial.json');
}

function initTrial() {
    const fp = trialFile();
    if (!fs.existsSync(fp)) {
        fs.writeFileSync(fp, JSON.stringify({ installedAt: Date.now() }), 'utf8');
    }
}

function getStatus() {
    const fp = trialFile();

    if (!fs.existsSync(fp)) {
        initTrial();
        return { active: true, expired: false, daysRemaining: TRIAL_DAYS };
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
        initTrial();
        return { active: true, expired: false, daysRemaining: TRIAL_DAYS };
    }

    const elapsed = Date.now() - (data.installedAt || Date.now());
    const daysRemaining = Math.max(0, Math.ceil((TRIAL_MS - elapsed) / (24 * 60 * 60 * 1000)));

    return {
        active: daysRemaining > 0,
        expired: daysRemaining === 0,
        daysRemaining,
    };
}

module.exports = { initTrial, getStatus, TRIAL_DAYS };
