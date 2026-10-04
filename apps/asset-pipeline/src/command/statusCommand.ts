// statusCommand.ts — what the render guard is doing: the running render, if any, and the last rows of the log.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The status lines for `rendersDir`: the running render or idle, then the last five log rows. */
export function statusCommand(
	rendersDir: string,
	memory: { readonly pressure: number; readonly swapMb: number },
): string[] {
	const lock = join(rendersDir, 'current.lock');
	const log = join(rendersDir, 'renders.tsv');
	const running = existsSync(lock) ? `running ${readFileSync(lock, 'utf8').trim()}` : 'idle';
	const rows = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').slice(-5) : [];
	return [running, `memory pressure ${String(memory.pressure)} · swap ${String(memory.swapMb)} MB`, ...rows];
}
