import { runLighthouseOnce } from './runLighthouse.js';

async function readInput(): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  }) as Promise<Record<string, any>>;
}

async function main() {
  const input = await readInput();
  try {
    const result = await runLighthouseOnce(input);
    process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
  } catch (err: any) {
    const error = {
      name: err.name ?? 'Error',
      message: err.message ?? String(err),
      code: err.code,
      protocolMethod: err.protocolMethod,
      retryable: err.retryable,
      attempt: err.attempt,
      url: err.url,
      durationMs: err.durationMs,
      details: err.details,
      stack: err.stack,
    };
    process.stdout.write(JSON.stringify({ ok: false, error }) + '\n');
  }
}

main().finally(() => process.exit(0));
