#!/usr/bin/env node
// Usage: node scripts/generate-key.js
// Generates a single MeetBrief license key. Keep this script private.

const crypto = require('crypto');
const _LS = 'mb_k9x2_v1';

const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
const check = crypto.createHmac('sha256', _LS)
    .update(p1 + p2)
    .digest('hex').slice(0, 4).toUpperCase();

console.log(`MEET-${p1}-${p2}-${check}`);
