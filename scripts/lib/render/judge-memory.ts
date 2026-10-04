// judge-memory.ts — whether a local render may start, continue or must stop, judged from memory pressure and swap.

/** The kernel's memory pressure levels on macOS. */
const pressureLevel = Object.freeze({ warning: 2, critical: 4 } as const);

/** Swap growth since the start of a render, in MB, at which the render is stopped. */
const swapLimitMb = 8192;

/** What a render is to do. */
export type MemoryVerdict =
	| { readonly action: 'go' }
	| { readonly action: 'refuse'; readonly reason: string }
	| { readonly action: 'abort'; readonly reason: string };

/**
 * Judges the memory state: before the start a warning already refuses, because loading the model pushes the
 * pressure further; while running only critical pressure or the swap limit stops the render.
 */
export function judgeMemory(running: boolean, pressure: number, swapGrowthMb: number): MemoryVerdict {
	if (!running && pressure >= pressureLevel.warning)
		return { action: 'refuse', reason: `memory pressure level ${String(pressure)} before the start` };
	if (running && pressure >= pressureLevel.critical)
		return { action: 'abort', reason: `memory pressure level ${String(pressure)}` };
	if (running && swapGrowthMb > swapLimitMb)
		return { action: 'abort', reason: `swap +${String(swapGrowthMb)} MB over the ${String(swapLimitMb)} MB limit` };
	return { action: 'go' };
}
