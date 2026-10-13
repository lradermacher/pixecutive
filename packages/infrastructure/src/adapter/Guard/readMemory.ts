// readMemory.ts — reads the memory pressure level and the swap in use from the macOS kernel.
import { execFileSync } from 'node:child_process';
import type { MemoryReading } from './memoryReading.interface.ts';

/** Asks `sysctl` for one key; it is the only source the kernel offers without root. */
function sysctl(key: string): string {
	return execFileSync('sysctl', ['-n', key], { encoding: 'utf8' }).trim();
}

/** The current memory reading; `read` answers a kernel key and is replaced in tests. */
export function readMemory(read: (key: string) => string = sysctl): MemoryReading {
	const used = /used = ([0-9.]+)M/.exec(read('vm.swapusage'))?.[1] ?? '0';
	return { pressure: Number(read('kern.memorystatus_vm_pressure_level')), swapMb: Math.round(Number(used)) };
}
