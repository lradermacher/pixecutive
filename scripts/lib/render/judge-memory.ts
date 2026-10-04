// judge-memory.ts — whether a local render may start, continue or must stop, judged from memory pressure and swap.
import { memoryAction, type MemoryAction } from './memory-action.ts';

/** The kernel's memory pressure levels on macOS. */
const pressureLevel = Object.freeze({ warning: 2, critical: 4 } as const);

/** Swap growth since the start of a render, in MB, at which the render is stopped. */
const swapLimitMb = 8192;

/** What a render is to do, and why when it is not to go on. */
export interface MemoryVerdict {
	readonly action: MemoryAction;
	readonly reason: string;
}

/**
 * Judges the memory state: before the start a warning already refuses, because loading the model pushes the
 * pressure further; while running only critical pressure or the swap limit stops the render.
 */
export function judgeMemory(running: boolean, pressure: number, swapGrowthMb: number): MemoryVerdict {
	if (!running && pressure >= pressureLevel.warning)
		return { action: memoryAction.refuse, reason: `memory pressure level ${String(pressure)} before the start` };
	if (running && pressure >= pressureLevel.critical)
		return { action: memoryAction.abort, reason: `memory pressure level ${String(pressure)}` };
	if (running && swapGrowthMb > swapLimitMb)
		return {
			action: memoryAction.abort,
			reason: `swap +${String(swapGrowthMb)} MB over the ${String(swapLimitMb)} MB limit`,
		};
	return { action: memoryAction.go, reason: '' };
}
