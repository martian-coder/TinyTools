import { loadEnv, port } from './config';
import { startServer } from './app';
import { defaults, allProviderDefs, toProviderInfo } from './providers/registry';

/** Run the backend on its own — `npm run server` / `npm run dev:server`. */
async function main(): Promise<void> {
  loadEnv();
  const running = await startServer(port());
  const available = allProviderDefs().map(toProviderInfo).filter((p) => p.available);
  const { provider, model } = defaults();

  console.log(`\n  Stealth Meeting Assistant backend`);
  console.log(`  ${running.url}`);
  console.log(`  token   ${running.token}`);
  console.log(
    `  models  ${available.length ? available.map((p) => p.id).join(', ') : 'none configured — copy .env.example to .env'}`,
  );
  console.log(`  default ${provider}/${model || '(unset)'}\n`);
  console.log(`  curl -H "x-assistant-token: ${running.token}" ${running.url}/api/models\n`);

  const shutdown = () => {
    running.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
