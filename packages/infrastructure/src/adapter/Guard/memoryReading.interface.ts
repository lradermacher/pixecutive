// memoryReading.interface.ts — one reading of the machine's memory pressure and swap.

/** The kernel's memory pressure level (1 normal, 2 warning, 4 critical) and the swap in use in MB. */
export interface MemoryReading {
	readonly pressure: number;
	readonly swapMb: number;
}
