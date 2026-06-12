import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class TrialExpiredView extends LitElement {
    static styles = css`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100vh;
            background: var(--bg-app);
        }

        .card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            padding: 48px 40px;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            max-width: 400px;
            width: 90%;
            text-align: center;
        }

        .brand {
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.02em;
        }

        .lock-ring {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ef4444;
        }

        .lock-ring svg {
            width: 26px;
            height: 26px;
        }

        .title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
            line-height: 1.3;
            margin: 0;
        }

        .subtitle {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
            margin: -12px 0 0;
        }

        .divider {
            width: 100%;
            height: 1px;
            background: var(--border);
        }

        .actions {
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
        }

        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 11px 20px;
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

        .btn svg {
            width: 15px;
            height: 15px;
            flex-shrink: 0;
        }

        .btn-primary {
            background: var(--accent, #3b82f6);
            color: #fff;
        }

        .btn-secondary {
            background: var(--bg-elevated);
            color: var(--text-primary);
            border: 1px solid var(--border-strong);
        }

        .note {
            font-size: 11px;
            color: var(--text-muted);
            line-height: 1.5;
        }
    `;

    _openEmail() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            // TODO: update contact email before distributing
            ipcRenderer.invoke('open-external',
                'mailto:hello@meetbrief.io?subject=MeetBrief%20License&body=Hi%2C%20I%27d%20like%20to%20get%20a%20license%20for%20MeetBrief.');
        }
    }

    _openWebsite() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('open-external', 'https://meetbrief.io');
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
                    <p class="subtitle">You've used your 25 days. Get a license to keep using MeetBrief.</p>
                </div>

                <div class="divider"></div>

                <div class="actions">
                    <button class="btn btn-primary" @click=${this._openEmail}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Email to get a license
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

                <div class="note">Already have a license? Reply to your purchase email to activate.</div>
            </div>
        `;
    }
}

customElements.define('trial-expired-view', TrialExpiredView);
