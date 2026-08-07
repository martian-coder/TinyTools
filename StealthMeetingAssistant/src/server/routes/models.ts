import { Router } from 'express';
import {
  addCustomProvider,
  allProviderDefs,
  defaults,
  removeCustomProvider,
  resolveApiKey,
  resolveBaseUrl,
  toProviderInfo,
  unavailableReason,
} from '../providers/registry';
import { listOpenAiModels } from '../llm/openaiCompatible';
import type { ModelsResponse } from '../../shared/types';

export const modelsRouter = Router();

/**
 * GET /api/models?refresh=1
 *
 * Always returns every provider, available or not — the UI greys out the
 * unavailable ones and shows why, rather than hiding them. `refresh=1` also
 * asks each reachable OpenAI-compatible endpoint for its live model list,
 * which is how Ollama and OpenRouter report what you actually have.
 */
modelsRouter.get('/models', async (req, res) => {
  const defs = allProviderDefs();
  const providers = defs.map(toProviderInfo);

  if (req.query.refresh === '1') {
    await Promise.all(
      defs.map(async (def, i) => {
        if (def.kind !== 'openai-compatible') return;
        if (unavailableReason(def)) return;
        const live = await listOpenAiModels(resolveBaseUrl(def)!, resolveApiKey(def));
        if (!live.length) return;
        const merged = new Set([providers[i].defaultModel, ...live]);
        merged.delete('');
        providers[i].models = Array.from(merged).sort();
      }),
    );
  }

  const { provider, model } = defaults();
  const body: ModelsResponse = { providers, defaultProvider: provider, defaultModel: model };
  res.json(body);
});

/** POST /api/providers — register a custom OpenAI-compatible endpoint. */
modelsRouter.post('/providers', (req, res) => {
  try {
    const entry = addCustomProvider({
      id: String(req.body?.id ?? ''),
      label: String(req.body?.label ?? ''),
      baseUrl: String(req.body?.baseUrl ?? ''),
      apiKeyEnv: req.body?.apiKeyEnv ? String(req.body.apiKeyEnv) : undefined,
      defaultModel: String(req.body?.defaultModel ?? ''),
      models: Array.isArray(req.body?.models) ? req.body.models.map(String) : undefined,
    });
    res.status(201).json({ provider: toProviderInfo({ ...providerDefFor(entry.id)! }) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

modelsRouter.delete('/providers/:id', (req, res) => {
  const removed = removeCustomProvider(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Custom provider not found' });
  res.json({ ok: true });
});

function providerDefFor(id: string) {
  return allProviderDefs().find((p) => p.id === id);
}
