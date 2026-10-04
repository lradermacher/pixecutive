// read-memory.ts — the current memory pressure level and swap use, read from the kernel; a probe sets them by hand.
import { execFileSync } from 'node:child_process';

let reads = 0;

/**
 * Returns the memory pressure level and the swap in use in MB. `PIX_RENDER_MEMORY` replaces the kernel so the probe
 * drives the guard without a model: "level,swapMb" for every read, or "start;running" to change after the first read.
 */
export function readMemory(): { readonly pressure: number; readonly swapMb: number } {
	const forced = process.env['PIX_RENDER_MEMORY'];
	if (forced !== undefined && forced !== '') {
		const phases = forced.split(';');
		const [pressure, swapMb] = (phases[Math.min(reads, phases.length - 1)] ?? '').split(',').map(Number);
		reads += 1;
		return { pressure: pressure ?? 1, swapMb: swapMb ?? 0 };
	}
	const sysctl = (key: string): string => execFileSync('sysctl', ['-n', key], { encoding: 'utf8' }).trim();
	const used = /used = ([0-9.]+)M/.exec(sysctl('vm.swapusage'))?.[1] ?? '0';
	return { pressure: Number(sysctl('kern.memorystatus_vm_pressure_level')), swapMb: Math.round(Number(used)) };
}
