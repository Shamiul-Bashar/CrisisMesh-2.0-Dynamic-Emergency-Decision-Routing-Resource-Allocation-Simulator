import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function simulationBridge(): Plugin {
  type Waiter = { resolve: (value: string) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };
  let child: ChildProcessWithoutNullStreams | null = null;
  let buffer = '';
  let stderrBuffer = '';
  const waiters: Waiter[] = [];
  const REQUEST_TIMEOUT_MS = 8000;

  const rejectPending = (message: string) => {
    const error = new Error(message);
    while (waiters.length) {
      const waiter = waiters.shift()!;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  };

  const start = () => {
    if (child && !child.killed) return;
    const exeBase = resolve(process.cwd(), 'backend', 'build', 'crisismesh_simulation_cli');
    const exe = existsSync(`${exeBase}.exe`) ? `${exeBase}.exe` : exeBase;
    if (!existsSync(exe)) return;

    child = spawn(exe, ['--server'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const spawnedChild = child;
    buffer = '';
    stderrBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const waiter = waiters.shift();
        if (!waiter) continue;
        clearTimeout(waiter.timer);
        waiter.resolve(line);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer = `${stderrBuffer}${chunk.toString()}`.slice(-2000);
    });

    spawnedChild.on('error', (error) => {
      rejectPending(`C++ simulation process error: ${error.message}`);
      if (child === spawnedChild) child = null;
    });

    spawnedChild.on('exit', (code, signal) => {
      const detail = stderrBuffer.trim();
      rejectPending(`C++ simulation process stopped${code !== null ? ` (exit ${code})` : ''}${signal ? ` (${signal})` : ''}${detail ? `: ${detail}` : '.'}`);
      if (child === spawnedChild) {
        child = null;
        buffer = '';
        stderrBuffer = '';
      }
    });
  };

  const send = (command: string) => new Promise<string>((resolvePromise, reject) => {
    start();
    if (!child) {
      reject(new Error('C++ simulation executable not found. Build backend first.'));
      return;
    }

    const timer = setTimeout(() => {
      const message = 'C++ Simulation Development Bridge timed out waiting for a response.';
      rejectPending(message);
      if (child && !child.killed) child.kill();
    }, REQUEST_TIMEOUT_MS);

    waiters.push({ resolve: resolvePromise, reject, timer });
    try {
      child.stdin.write(`${command}\n`);
    } catch (error) {
      clearTimeout(timer);
      const index = waiters.findIndex((item) => item.resolve === resolvePromise);
      if (index >= 0) waiters.splice(index, 1);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });

  return {
    name: 'crisismesh-simulation-bridge',
    configureServer(server) {
      server.middlewares.use('/api/simulation', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'POST is required for the simulation bridge.' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const input = JSON.parse(body || '{}') as Record<string, unknown>;
            const action = String(input.action ?? 'STATE');
            const clean = (value: unknown) => String(value ?? '').replace(/\\/g, '/').replace(/\|/g, ' ');
            let command: string;
            switch (action) {
              case 'STATE': command = 'STATE'; break;
              case 'REPORT':
                command = `REPORT|${clean(input.type)}|${clean(input.locationId)}|${clean(input.severity)}|${clean(input.urgency)}|${clean(input.victimCount)}|${clean(input.description)}`;
                break;
              case 'BLOCK': command = `BLOCK|${clean(input.edgeId)}`; break;
              case 'UNBLOCK': command = `UNBLOCK|${clean(input.edgeId)}`; break;
              case 'UNDO_BLOCK': command = 'UNDO_BLOCK'; break;
              case 'PROCESS_NEXT': command = 'PROCESS_NEXT'; break;
              case 'SET_RESPONDER': command = `SET_RESPONDER|${clean(input.responderId)}|${clean(input.availability)}`; break;
              case 'RESOLVE': command = `RESOLVE|${clean(input.incidentId)}`; break;
              case 'RESET': command = 'RESET'; break;
              default:
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: `Unsupported simulation action: ${action}` }));
                return;
            }

            const raw = await send(command);
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              throw new Error('The C++ simulation bridge returned malformed JSON.');
            }
            if (!parsed || typeof parsed !== 'object') throw new Error('The C++ simulation bridge returned an invalid response object.');
            res.setHeader('Content-Type', 'application/json');
            res.end(raw);
          } catch (error: unknown) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            const message = error instanceof Error ? error.message : String(error);
            res.end(JSON.stringify({ ok: false, error: message }));
          }
        });
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), simulationBridge()],
});
