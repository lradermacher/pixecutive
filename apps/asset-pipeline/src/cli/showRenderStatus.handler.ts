// showRenderStatus.handler.ts — `status`: what the local renderer is doing, as lines for the command line.
import type { RenderImageService } from '@pixecutive/core';

/** The running render or idle, the memory, then the last log rows. */
export function showRenderStatusHandler(service: RenderImageService): string[] {
	const status = service.status();
	return [
		status.running === null ? 'idle' : `running ${status.running}`,
		`memory pressure ${String(status.pressure)} · swap ${String(status.swapMb)} MB`,
		...status.lastRows,
	];
}
