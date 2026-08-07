/* Overlay renderer. Vanilla JS on purpose — no build step, no framework tax
   on a 420x520 window. Talks to the local backend over fetch + NDJSON. */

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const state = {
    baseUrl: '',
    token: '',
    provider: '',
    model: '',
    mode: 'executive',
    providers: [],
    documents: [],
    transcript: [],
    history: [],
    busy: false,
    paused: false,
    interactive: true,
    contentProtection: false,
    lastRequest: null,
    abort: null,
  };

  /* ── Bootstrap ─────────────────────────────────────────────── */

  async function boot() {
    const params = new URLSearchParams(location.search);
    state.baseUrl = location.origin.startsWith('http') ? location.origin : 'http://127.0.0.1:5173';
    state.token = params.get('token') || '';

    // Running inside Electron: preload hands over the real token and platform.
    if (window.overlay?.getConfig) {
      try {
        const cfg = await window.overlay.getConfig();
        state.token = cfg.token || state.token;
        state.baseUrl = cfg.baseUrl || state.baseUrl;
        state.contentProtection = Boolean(cfg.contentProtectionSupported);
        state.interactive = cfg.interactive !== false;
      } catch (err) {
        console.warn('overlay config unavailable', err);
      }
      window.overlay.onHotkey(onHotkey);
      window.overlay.onInteractiveChange((value) => {
        state.interactive = value;
        document.body.classList.toggle('click-through', !value);
        toast(value ? 'Interactive' : 'Click-through — clicks pass through');
      });
    }

    wireUi();
    await Promise.all([loadModels(), loadDocuments(), loadTranscript()]);
    subscribeDocumentEvents();
    connectTranscriptSocket();
    setStatus('ready', 'Ready');
  }

  /* ── HTTP ──────────────────────────────────────────────────── */

  async function api(path, options = {}) {
    const res = await fetch(state.baseUrl + path, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { 'content-type': 'application/json' }
          : {}),
        'x-assistant-token': state.token,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    return res.status === 204 ? null : res.json();
  }

  /* ── Providers & models ────────────────────────────────────── */

  async function loadModels(refresh = false) {
    try {
      const data = await api(`/api/models${refresh ? '?refresh=1' : ''}`);
      state.providers = data.providers;
      if (!state.provider) {
        state.provider = data.defaultProvider;
        state.model = data.defaultModel;
      }
      renderProviderChip();
      renderProviderPanel();
    } catch (err) {
      setStatus('error', 'Backend unreachable');
      toast(err.message, true);
    }
  }

  function currentProvider() {
    return state.providers.find((p) => p.id === state.provider);
  }

  function renderProviderChip() {
    const provider = currentProvider();
    const label = $('providerLabel');
    if (!provider) {
      label.textContent = 'no provider';
      return;
    }
    label.textContent = `${provider.id}/${shortModel(state.model || provider.defaultModel)}`;
    $('providerChip').classList.toggle('unavailable', !provider.available);
    $('providerChip').title = provider.available
      ? `${provider.label} — ${state.model}`
      : provider.unavailableReason;
    if (!provider.available) setStatus('error', provider.unavailableReason);
  }

  function shortModel(model) {
    if (!model) return '(none)';
    // openrouter ids are namespaced; the last segment is the recognisable bit.
    const parts = model.split('/');
    return parts[parts.length - 1];
  }

  function renderProviderPanel() {
    const select = $('providerSelect');
    select.innerHTML = '';
    for (const provider of state.providers) {
      const option = document.createElement('option');
      option.value = provider.id;
      option.textContent = provider.available
        ? `${provider.label}`
        : `${provider.label} — unavailable`;
      option.disabled = !provider.available;
      option.selected = provider.id === state.provider;
      select.append(option);
    }
    syncModelList();
  }

  function syncModelList() {
    const provider = state.providers.find((p) => p.id === $('providerSelect').value);
    const list = $('modelList');
    list.innerHTML = '';
    for (const model of provider?.models ?? []) {
      const option = document.createElement('option');
      option.value = model;
      list.append(option);
    }
    $('modelInput').value =
      provider?.id === state.provider ? state.model || provider.defaultModel : provider?.defaultModel ?? '';
    const hint = $('providerHint');
    if (!provider) {
      hint.textContent = '';
    } else if (provider.available) {
      hint.className = 'hint';
      hint.textContent = `${provider.baseUrl} · key from ${provider.apiKeyEnv ?? 'no key needed'}`;
    } else {
      hint.className = 'hint error';
      hint.textContent = provider.unavailableReason;
    }
  }

  /**
   * Switching mid-session deliberately keeps history, transcript and
   * documents — only the endpoint changes.
   */
  function applyModel() {
    const provider = state.providers.find((p) => p.id === $('providerSelect').value);
    if (!provider) return;
    if (!provider.available) {
      toast(provider.unavailableReason, true);
      return;
    }
    state.provider = provider.id;
    state.model = $('modelInput').value.trim() || provider.defaultModel;
    renderProviderChip();
    setStatus('ready', `Switched to ${provider.label}`);
    closePanels();
    toast(`Now using ${provider.id}/${shortModel(state.model)}`);
  }

  async function addCustomProvider() {
    const body = {
      id: $('cpId').value.trim(),
      label: $('cpId').value.trim(),
      baseUrl: $('cpUrl').value.trim(),
      apiKeyEnv: $('cpKeyEnv').value.trim() || undefined,
      defaultModel: $('cpModel').value.trim(),
    };
    try {
      await api('/api/providers', { method: 'POST', body: JSON.stringify(body) });
      await loadModels();
      toast(`Added ${body.id}`);
      for (const id of ['cpId', 'cpUrl', 'cpKeyEnv', 'cpModel']) $(id).value = '';
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ── Chat ──────────────────────────────────────────────────── */

  async function ask({ message, action }) {
    if (state.busy) {
      state.abort?.abort();
    }
    if (state.paused) {
      toast('Assistant paused — Ctrl+Shift+P to resume');
      return;
    }
    const provider = currentProvider();
    if (!provider?.available) {
      showError(provider?.unavailableReason ?? 'No provider configured', false);
      return;
    }

    state.lastRequest = { message, action };
    state.busy = true;
    state.abort = new AbortController();
    hideError();
    setStatus('busy', action ? labelForAction(action) : 'Thinking…');
    $('emptyState').hidden = true;
    const body = $('answerBody');
    body.textContent = '';
    body.classList.add('streaming');
    $('sources').hidden = true;

    const contextLines = Number($('ctxLines').value) || 18;
    const payload = {
      provider: state.provider,
      model: state.model,
      mode: state.mode,
      message: message ?? '',
      action: action ?? 'ask',
      history: state.history.slice(-6),
      transcriptContext: state.transcript.slice(-contextLines),
      useDocuments: $('useDocs').checked,
    };

    let answer = '';
    try {
      const res = await fetch(`${state.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-assistant-token': state.token },
        body: JSON.stringify(payload),
        signal: state.abort.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail.slice(0, 200) || `${res.status} ${res.statusText}`);
      }

      for await (const frame of readNdjson(res.body)) {
        if (frame.type === 'sources') {
          renderSources(frame.sources, frame.note);
        } else if (frame.type === 'delta') {
          answer += frame.text;
          body.innerHTML = renderMarkdown(answer);
          body.scrollIntoView({ block: 'end' });
          $('answer').scrollTop = $('answer').scrollHeight;
        } else if (frame.type === 'done') {
          answer = frame.text || answer;
          body.innerHTML = renderMarkdown(answer);
          setStatus('ready', `Done in ${(frame.elapsedMs / 1000).toFixed(1)}s`);
        } else if (frame.type === 'error') {
          showError(frame.message, frame.retryable);
          setStatus('error', 'Error');
        }
      }

      if (answer.trim()) {
        state.history.push({ role: 'user', content: message || labelForAction(action) });
        state.history.push({ role: 'assistant', content: answer });
        state.history = state.history.slice(-12);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showError(err.message, true);
        setStatus('error', 'Error');
      }
    } finally {
      body.classList.remove('streaming');
      state.busy = false;
      state.abort = null;
    }
  }

  /** Parse the NDJSON response stream, one JSON object per line. */
  async function* readNdjson(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (line) {
            try {
              yield JSON.parse(line);
            } catch {
              /* partial frame; the next chunk completes it */
            }
          }
        }
      }
      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim());
        } catch {
          /* ignore trailing garbage */
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  function renderSources(sources, note) {
    const container = $('sources');
    container.innerHTML = '';
    if (!sources?.length) {
      if (note) {
        container.hidden = false;
        const empty = document.createElement('div');
        empty.className = 'sources-title';
        empty.textContent = note;
        container.append(empty);
      } else {
        container.hidden = true;
      }
      return;
    }

    container.hidden = false;
    const title = document.createElement('div');
    title.className = 'sources-title';
    title.textContent = note ? `Sources — ${note}` : 'Sources';
    container.append(title);

    sources.forEach((source, i) => {
      const row = document.createElement('div');
      row.className = 'source';

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = `[${i + 1}]`;

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = source.fileName;

      const where = document.createElement('span');
      where.textContent = source.page ? `p.${source.page}` : (source.section ?? '');

      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = source.score.toFixed(2);

      row.append(num, name, where, score);

      // Click a citation to read the exact chunk the model was given.
      const excerpt = document.createElement('div');
      excerpt.className = 'source-text';
      excerpt.textContent = source.text;
      excerpt.hidden = true;
      row.addEventListener('click', () => {
        excerpt.hidden = !excerpt.hidden;
      });

      container.append(row, excerpt);
    });
  }

  /* ── Minimal, escaping-first markdown ──────────────────────── */

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Deliberately tiny. Everything is escaped first, so model output can never
   * inject markup into the overlay — the only tags present are the ones this
   * function adds itself.
   */
  function renderMarkdown(text) {
    const escaped = escapeHtml(text);
    const lines = escaped.split('\n');
    const out = [];
    let inList = false;
    let inCode = false;

    const closeList = () => {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    };

    for (const raw of lines) {
      const line = raw.trimEnd();

      if (line.trim().startsWith('```')) {
        closeList();
        out.push(inCode ? '</code></pre>' : '<pre><code>');
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        out.push(`${line}\n`);
        continue;
      }

      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        closeList();
        out.push(`<h3>${inline(heading[2])}</h3>`);
        continue;
      }

      const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line);
      if (bullet) {
        if (!inList) {
          out.push('<ul>');
          inList = true;
        }
        out.push(`<li>${inline(bullet[1])}</li>`);
        continue;
      }

      closeList();
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }

    closeList();
    if (inCode) out.push('</code></pre>');
    return out.join('');
  }

  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, '$1<em>$2</em>');
  }

  /* ── Documents ─────────────────────────────────────────────── */

  async function loadDocuments() {
    try {
      const data = await api('/api/documents');
      state.documents = data.documents;
      renderDocuments();
    } catch (err) {
      console.warn('documents unavailable', err);
    }
  }

  function renderDocuments() {
    const list = $('docList');
    list.innerHTML = '';

    const ready = state.documents.filter((d) => d.status === 'ready').length;
    const badge = $('docBadge');
    badge.textContent = String(ready);
    badge.classList.toggle('zero', ready === 0);

    if (!state.documents.length) {
      const empty = document.createElement('li');
      empty.className = 'hint';
      empty.textContent = 'No documents attached yet.';
      list.append(empty);
      return;
    }

    for (const doc of state.documents) {
      const item = document.createElement('li');
      item.className = 'doc';

      const name = document.createElement('span');
      name.className = 'doc-name';
      name.textContent = doc.fileName;
      name.title = doc.error ? doc.error : doc.fileName;

      const meta = document.createElement('span');
      meta.className = 'doc-meta';
      meta.textContent = doc.status === 'ready' ? `${doc.chunkCount} chunks` : formatBytes(doc.bytes);

      const status = document.createElement('span');
      status.className = `doc-status ${doc.status}`;
      status.textContent = doc.status;
      if (doc.error) status.title = doc.error;

      const remove = document.createElement('button');
      remove.className = 'icon';
      remove.textContent = '✕';
      remove.title = 'Remove document';
      remove.addEventListener('click', async () => {
        try {
          const data = await api(`/api/documents/${doc.id}`, { method: 'DELETE' });
          state.documents = data.documents;
          renderDocuments();
          toast(`Removed ${doc.fileName}`);
        } catch (err) {
          toast(err.message, true);
        }
      });

      item.append(name, meta, status, remove);
      list.append(item);
    }
  }

  /** Server-sent indexing status, so queued → ready animates without polling. */
  function subscribeDocumentEvents() {
    try {
      const source = new EventSource(
        `${state.baseUrl}/api/documents/events?token=${encodeURIComponent(state.token)}`,
      );
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.documents) {
            state.documents = data.documents;
            renderDocuments();
          }
        } catch {
          /* ignore malformed frame */
        }
      };
      source.onerror = () => {
        // EventSource retries on its own; a poll keeps the list fresh anyway.
        setTimeout(loadDocuments, 3000);
      };
    } catch (err) {
      console.warn('document events unavailable', err);
    }
  }

  async function uploadFiles(files) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const form = new FormData();
    for (const file of list) form.append('files', file, file.name);

    toast(`Indexing ${list.length} file${list.length > 1 ? 's' : ''}…`);
    try {
      const data = await api('/api/documents/upload', { method: 'POST', body: form });
      state.documents = data.documents;
      renderDocuments();
      const failed = data.results.filter((r) => !r.ok);
      const deduped = data.results.filter((r) => r.ok && r.deduplicated);
      if (failed.length) toast(`${failed[0].fileName}: ${failed[0].error}`, true);
      else if (deduped.length) toast('Already indexed (identical content)');
      else toast('Indexed');
    } catch (err) {
      toast(err.message, true);
    }
  }

  /**
   * In-overlay file browser. A native OS dialog opens a separate window that
   * screen sharing captures even though the overlay is protected, so the
   * picker lives inside the protected window instead.
   */
  async function browse(dir) {
    try {
      const data = await api(`/api/files/browse${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`);
      $('browser').hidden = false;
      $('browserPath').textContent = data.dir;

      const list = $('browserList');
      list.innerHTML = '';

      if (data.parent) {
        list.append(browserRow('📁', '..', () => browse(data.parent)));
      }
      for (const entry of data.dirs) {
        list.append(browserRow('📁', entry.name, () => browse(entry.path)));
      }
      for (const file of data.files) {
        list.append(
          browserRow('📄', file.name, async () => {
            try {
              const result = await api('/api/documents/attach', {
                method: 'POST',
                body: JSON.stringify({ path: file.path }),
              });
              state.documents = result.documents;
              renderDocuments();
              toast(result.deduplicated ? 'Already indexed' : `Indexed ${file.name}`);
            } catch (err) {
              toast(err.message, true);
            }
          }, formatBytes(file.bytes)),
        );
      }
      if (!data.dirs.length && !data.files.length) {
        const empty = document.createElement('div');
        empty.className = 'hint';
        empty.style.padding = '8px';
        empty.textContent = 'No supported files here.';
        list.append(empty);
      }
    } catch (err) {
      toast(err.message, true);
    }
  }

  function browserRow(kind, name, onClick, size) {
    const button = document.createElement('button');
    button.className = 'browser-item';

    const icon = document.createElement('span');
    icon.className = 'kind';
    icon.textContent = kind;

    const label = document.createElement('span');
    label.textContent = name;

    button.append(icon, label);
    if (size) {
      const sizeEl = document.createElement('span');
      sizeEl.className = 'size';
      sizeEl.textContent = size;
      button.append(sizeEl);
    }
    button.addEventListener('click', onClick);
    return button;
  }

  function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /* ── Transcript ────────────────────────────────────────────── */

  async function loadTranscript() {
    try {
      const data = await api('/api/session/transcript?limit=60');
      state.transcript = data.lines;
      renderTranscript();
    } catch (err) {
      console.warn('transcript unavailable', err);
    }
  }

  function renderTranscript() {
    const body = $('transcriptBody');
    body.innerHTML = '';
    for (const line of state.transcript.slice(-60)) {
      const row = document.createElement('div');
      row.className = `tline${line.isFinal ? '' : ' interim'}`;

      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = `${line.speaker}: `;

      row.append(who, document.createTextNode(line.text));
      body.append(row);
    }
    body.scrollTop = body.scrollHeight;
    $('transcriptCount').textContent = `${state.transcript.length} lines`;
  }

  /** Live push from an STT bridge shows up here without polling. */
  function connectTranscriptSocket() {
    try {
      const url = `${state.baseUrl.replace(/^http/, 'ws')}/ws/transcript?token=${encodeURIComponent(state.token)}`;
      const socket = new WebSocket(url);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcript' && data.line) {
            const last = state.transcript[state.transcript.length - 1];
            if (last && !last.isFinal && last.speaker === data.line.speaker) {
              state.transcript[state.transcript.length - 1] = data.line;
            } else {
              state.transcript.push(data.line);
            }
            renderTranscript();
          }
        } catch {
          /* ignore malformed frame */
        }
      };
      socket.onclose = () => setTimeout(connectTranscriptSocket, 4000);
    } catch (err) {
      console.warn('transcript socket unavailable', err);
    }
  }

  async function pushTranscript(events) {
    try {
      await api('/api/session/transcript', {
        method: 'POST',
        body: JSON.stringify({ events }),
      });
      await loadTranscript();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function parsePastedTranscript(text) {
    const now = Date.now();
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const match = /^([^:]{1,40}):\s*(.+)$/.exec(line);
        return {
          speaker: match ? match[1].trim() : 'Speaker',
          text: match ? match[2].trim() : line,
          isFinal: true,
          timestamp: now + i * 1000,
        };
      });
  }

  const MOCK_MEETING = [
    ['Priya', 'Quick status on the checkout revamp before we get into risks.'],
    ['Dan', 'Backend is done except the payment retry path. That slipped to next sprint.'],
    ['Priya', 'What is blocking the retry path?'],
    ['Dan', 'We never settled the API timeout. Gateway defaults to 30 seconds, our client gives up at 10.'],
    ['Maya', 'The spec says 15 seconds with two retries. That was the decision from the design review.'],
    ['Dan', 'Then our client config is wrong. I will fix it this week.'],
    ['Priya', 'Good. Maya, can you confirm the load test numbers before Thursday?'],
    ['Maya', 'Yes, I will rerun with the new timeout and post results Wednesday.'],
    ['Priya', 'Last thing, the vendor contract renewal is still unsigned and that is a real risk for Q3.'],
  ];

  function mockTranscript() {
    const start = Date.now() - MOCK_MEETING.length * 20000;
    pushTranscript(
      MOCK_MEETING.map(([speaker, text], i) => ({
        speaker,
        text,
        isFinal: true,
        timestamp: start + i * 20000,
      })),
    );
    $('transcript').classList.remove('collapsed');
    toast('Mock meeting loaded');
  }

  /* ── UI plumbing ───────────────────────────────────────────── */

  function setStatus(kind, text, meta) {
    $('statusDot').className = `status ${kind}`;
    $('statusText').textContent = text;
    if (meta !== undefined) $('statusMeta').textContent = meta;
  }

  function showError(message, retryable) {
    $('errorBox').hidden = false;
    $('errorText').textContent = message;
    $('btnRetry').hidden = !retryable;
  }

  function hideError() {
    $('errorBox').hidden = true;
  }

  let toastTimer;
  function toast(message, isError = false) {
    const el = $('toast');
    el.textContent = message;
    el.className = `toast${isError ? ' error' : ''}`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, isError ? 5200 : 2400);
  }

  function labelForAction(action) {
    return (
      {
        summarize: 'Summarizing…',
        'action-items': 'Extracting actions…',
        risks: 'Finding risks…',
        'suggest-reply': 'Drafting reply…',
        'explain-jargon': 'Explaining…',
        'follow-up-email': 'Drafting email…',
      }[action] ?? 'Thinking…'
    );
  }

  function openPanel(id) {
    closePanels();
    $(id).hidden = false;
  }

  function closePanels() {
    for (const id of ['panelModels', 'panelDocs', 'panelSettings']) $(id).hidden = true;
    $('browser').hidden = true;
  }

  function setMode(mode) {
    state.mode = mode;
    for (const button of document.querySelectorAll('.mode')) {
      button.classList.toggle('active', button.dataset.mode === mode);
    }
  }

  function onHotkey(action) {
    switch (action) {
      case 'models':
        openPanel('panelModels');
        break;
      case 'documents':
        openPanel('panelDocs');
        break;
      case 'pause':
        state.paused = !state.paused;
        setStatus(state.paused ? 'paused' : 'ready', state.paused ? 'Paused' : 'Ready');
        toast(state.paused ? 'Assistant paused' : 'Assistant resumed');
        break;
      case 'summarize':
        closePanels();
        ask({ action: 'summarize' });
        break;
      case 'action-items':
        closePanels();
        ask({ action: 'action-items' });
        break;
      case 'retrieve':
        closePanels();
        retrieveContext();
        break;
      default:
        break;
    }
  }

  /** Ctrl+Shift+R: show what the documents say about the current discussion. */
  async function retrieveContext() {
    const recent = state.transcript.slice(-6).map((l) => l.text).join(' ');
    const query = $('input').value.trim() || recent;
    if (!query) {
      toast('Nothing to search — say something or type a question first');
      return;
    }
    setStatus('busy', 'Retrieving…');
    try {
      const data = await api('/api/retrieval/search', {
        method: 'POST',
        body: JSON.stringify({ query, topK: 6 }),
      });
      $('emptyState').hidden = true;
      $('answerBody').innerHTML = '';
      renderSources(data.chunks, data.note ?? 'Retrieved context (no model call)');
      setStatus('ready', `${data.chunks.length} chunks`);
    } catch (err) {
      showError(err.message, true);
      setStatus('error', 'Error');
    }
  }

  function wireUi() {
    setMode(state.mode);

    $('btnSend').addEventListener('click', submit);
    $('input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });

    function submit() {
      const message = $('input').value.trim();
      if (!message) return;
      $('input').value = '';
      ask({ message, action: 'ask' });
    }

    for (const button of document.querySelectorAll('.pill')) {
      button.addEventListener('click', () => ask({ action: button.dataset.action }));
    }
    for (const button of document.querySelectorAll('.mode')) {
      button.addEventListener('click', () => setMode(button.dataset.mode));
    }
    for (const button of document.querySelectorAll('[data-close]')) {
      button.addEventListener('click', () => {
        $(button.dataset.close).hidden = true;
      });
    }

    $('providerChip').addEventListener('click', () => openPanel('panelModels'));
    $('btnDocs').addEventListener('click', () => openPanel('panelDocs'));
    $('btnAttach').addEventListener('click', () => openPanel('panelDocs'));
    $('btnSettings').addEventListener('click', () => {
      renderSettings();
      openPanel('panelSettings');
    });
    $('btnHide').addEventListener('click', () => window.overlay?.hide());
    $('btnRetry').addEventListener('click', () => {
      if (state.lastRequest) ask(state.lastRequest);
    });

    $('providerSelect').addEventListener('change', syncModelList);
    $('btnApplyModel').addEventListener('click', applyModel);
    $('btnRefreshModels').addEventListener('click', async () => {
      toast('Refreshing model list…');
      await loadModels(true);
      syncModelList();
    });
    $('btnAddProvider').addEventListener('click', addCustomProvider);

    $('btnBrowse').addEventListener('click', () => browse());
    $('transcriptToggle').addEventListener('click', () => {
      $('transcript').classList.toggle('collapsed');
    });
    $('btnPasteTranscript').addEventListener('click', () => {
      const text = $('transcriptPaste').value.trim();
      if (!text) return;
      pushTranscript(parsePastedTranscript(text));
      $('transcriptPaste').value = '';
    });
    $('btnMockTranscript').addEventListener('click', mockTranscript);
    $('btnClearTranscript').addEventListener('click', async () => {
      await api('/api/session/transcript', { method: 'DELETE' }).catch(() => undefined);
      state.transcript = [];
      renderTranscript();
    });

    $('btnToggleClickThrough').addEventListener('click', () => {
      window.overlay?.setInteractive(!state.interactive);
    });
    $('btnQuit').addEventListener('click', () => window.overlay?.quit());

    // Drag-and-drop anywhere on the overlay, not just the drop zone.
    const zone = $('dropzone');
    document.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('hot');
      $('panelDocs').hidden = false;
    });
    document.addEventListener('dragleave', (event) => {
      if (event.relatedTarget === null) zone.classList.remove('hot');
    });
    document.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('hot');
      uploadFiles(event.dataTransfer?.files);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanels();
    });
  }

  function renderSettings() {
    const provider = currentProvider();
    const rows = [
      ['Backend', state.baseUrl],
      ['Provider', provider ? `${provider.label} (${state.provider})` : '—'],
      ['Model', state.model || '—'],
      ['Documents', `${state.documents.filter((d) => d.status === 'ready').length} indexed`],
      ['Transcript', `${state.transcript.length} lines (memory only)`],
    ];
    $('settingsInfo').innerHTML = '';
    for (const [key, value] of rows) {
      const row = document.createElement('div');
      const label = document.createElement('b');
      label.textContent = `${key}: `;
      row.append(label, document.createTextNode(value));
      $('settingsInfo').append(row);
    }
    $('protectionHint').textContent = state.contentProtection
      ? 'Capture protection is active: this window is excluded from screen sharing by the OS.'
      : 'Capture protection is NOT available on this platform (Linux/X11). This window WILL appear in screen shares.';
    $('protectionHint').className = state.contentProtection ? 'hint' : 'hint error';
  }

  boot().catch((err) => {
    console.error(err);
    setStatus('error', 'Failed to start');
  });
})();
