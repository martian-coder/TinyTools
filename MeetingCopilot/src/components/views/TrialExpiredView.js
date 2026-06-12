import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class TrialExpiredView extends LitElement {
    static properties = {
        _keyInput:   { state: true },
        _keyError:   { state: true },
        _activating: { state: true },
        _activated:  { state: true },
    };

    constructor() {
        super();
        this._keyInput   = '';
        this._keyError   = '';
        this._activating = false;
        this._activated  = false;
    }

    static styles = css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100vh;
            background: var(--bg-app);
            overflow-y: auto;
        }

        .card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            padding: 40px 36px;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            margin: auto;
        }

        .brand {
            font-size: 19px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.02em;
        }

        .lock-ring {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ef4444;
        }

        .lock-ring svg { width: 24px; height: 24px; }

        .title {
            font-size: 17px;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0;
        }

        .subtitle {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin: -8px 0 0;
        }

        .divider {
            width: 100%;
            height: 1px;
            background: var(--border);
        }

        .actions {
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
        }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: opacity 0.15s ease;
            width: 100%;
            font-family: var(--font);
        }

        .btn:hover { opacity: 0.82; }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn svg { width: 14px; height: 14px; flex-shrink: 0; }

        .btn-primary { background: var(--accent, #3b82f6); color: #fff; }

        .btn-secondary {
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border-strong);
        }

        /* ── License key input ── */
        .key-section {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
            text-align: left;
        }

        .key-label {
            font-size: 11px;
            font-weight: 500;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .key-row {
            display: flex;
            gap: 8px;
        }

        .key-input {
            flex: 1;
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 9px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-family: var(--font-mono);
            letter-spacing: 0.05em;
            transition: border-color 0.15s;
            outline: none;
        }

        .key-input::placeholder { color: var(--text-muted); letter-spacing: 0; }
        .key-input:focus { border-color: var(--accent, #3b82f6); }
        .key-input.error { border-color: #ef4444; }

        .key-submit {
            padding: 9px 14px;
            background: var(--accent, #3b82f6);
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            font-family: var(--font);
            white-space: nowrap;
            transition: opacity 0.15s;
        }

        .key-submit:hover { opacity: 0.85; }
        .key-submit:disabled { opacity: 0.45; cursor: not-allowed; }

        .key-error {
            font-size: 12px;
            color: #ef4444;
        }

        .key-success {
            font-size: 12px;
            color: var(--success, #22c55e);
            display: flex;
            align-items: center;
            gap: 5px;
        }

        /* ── Privacy section ── */
        .privacy-block {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 9px;
            padding: 14px 16px;
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.12);
            border-radius: 10px;
            text-align: left;
        }

        .privacy-row {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        .privacy-row svg {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            color: var(--accent, #3b82f6);
        }
    `;

    _openEmail() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('open-external',
                'mailto:martian.coders.x@gmail.com?subject=MeetBrief%20License%20Request&body=Hi%2C%0A%0AI%27d%20like%20to%20get%20a%20license%20for%20MeetBrief.%0A%0AThanks!');
        }
    }

    _openWebsite() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('open-external', 'https://meetbrief.io');
        }
    }

    async _activate() {
        const key = this._keyInput.trim().toUpperCase();
        if (!key || this._activating) return;
        this._keyError = '';
        this._activating = true;
        this.requestUpdate();

        const success = await copilot.trial.activateLicense(key);
        this._activating = false;

        if (success) {
            this._activated = true;
            this.requestUpdate();
            setTimeout(() => window.location.reload(), 1200);
        } else {
            this._keyError = 'Invalid key — check for typos and try again.';
            this.requestUpdate();
        }
    }

    render() {
        return html`
            <div class="card">
                <div class="brand">MeetBrief</div>

                <div class="lock-ring">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>

                <div>
                    <p class="title">Your free trial has ended</p>
                    <p class="subtitle">25 days are up. Reach out to get a license and keep going.</p>
                </div>

                <div class="divider"></div>

                <div class="actions">
                    <button class="btn btn-primary" @click=${this._openEmail}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Email martian.coders.x@gmail.com
                    </button>
                    <button class="btn btn-secondary" @click=${this._openWebsite}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                        Visit meetbrief.io
                    </button>
                </div>

                <div class="divider"></div>

                <!-- License key entry -->
                <div class="key-section">
                    <div class="key-label">Already have a license key?</div>
                    <div class="key-row">
                        <input
                            class="key-input ${this._keyError ? 'error' : ''}"
                            type="text"
                            placeholder="MEET-XXXX-XXXX-XXXX"
                            maxlength="19"
                            spellcheck="false"
                            autocomplete="off"
                            .value=${this._keyInput}
                            @input=${e => { this._keyInput = e.target.value.toUpperCase(); this._keyError = ''; }}
                            @keydown=${e => e.key === 'Enter' && this._activate()}
                        />
                        <button class="key-submit" ?disabled=${this._activating || this._activated}
                                @click=${this._activate}>
                            ${this._activating ? 'Checking…' : this._activated ? '✓' : 'Activate'}
                        </button>
                    </div>
                    ${this._keyError ? html`<div class="key-error">${this._keyError}</div>` : ''}
                    ${this._activated ? html`
                        <div class="key-success">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            License activated — reloading…
                        </div>
                    ` : ''}
                </div>

                <div class="divider"></div>

                <!-- Privacy trust block -->
                <div class="privacy-block">
                    <div class="privacy-row">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        <span>Uses <strong>your own API key</strong> — we never see it</span>
                    </div>
                    <div class="privacy-row">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        <span>Audio processed <strong>100% on your machine</strong></span>
                    </div>
                    <div class="privacy-row">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                        <span>Nothing recorded or sent to MeetBrief servers</span>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('trial-expired-view', TrialExpiredView);
