// judgeMemory.ts — whether a local render may start, go on or must stop, judged from memory pressure and swap.
import { MemoryAction } from './memoryAction.enum.ts';

/** The kernel's memory pressure levels on macOS. */
const pressureLevel = Object.freeze({ warning: 2, critical: 4 });

/** Swap growth since the start of a render, in MB, at which it is stopped; only a brake against runaway swapping, because loading the model swaps several GB even with RAM free. */
const swapLimitMb = 16384;

/**
 * Before the start a warning already refuses, because loading the model pushes the pressure further; while running
 * only critical pressure or the swap limit stops the render. The reason is empty when the render may go on.
 */
export function judgeMemory(
	running: boolean,
	pressure: number,
	swapGrowthMb: number,
): { readonly action: MemoryAction; readonly reason: string } {
	if (!running && pressure >= pressureLevel.warning)
		return { action: MemoryAction.Refuse, reason: `memory pressure level ${String(pressure)} before the start` };
	if (running && pressure >= pressureLevel.critical)
		return { action: MemoryAction.Abort, reason: `memory pressure level ${String(pressure)}` };
	if (running && swapGrowthMb > swapLimitMb)
		return {
			action: MemoryAction.Abort,
			reason: `swap +${String(swapGrowthMb)} MB over the ${String(swapLimitMb)} MB limit`,
		};
	return { action: MemoryAction.Go, reason: '' };
}
