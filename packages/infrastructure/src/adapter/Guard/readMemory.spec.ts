import { describe, expect, it } from 'vitest';
import { readMemory } from './readMemory.ts';

describe('readMemory', () => {
	it('reads the pressure level and the used swap from the kernel answers', () => {
		const answers: Record<string, string> = {
			'kern.memorystatus_vm_pressure_level': '2',
			'vm.swapusage': 'total = 13312.00M  used = 9714.25M  free = 3597.75M  (encrypted)',
		};
		expect(readMemory((key) => answers[key] ?? '')).toEqual({ pressure: 2, swapMb: 9714 });
	});

	it('reads no swap as zero', () => {
		expect(readMemory((key) => (key === 'vm.swapusage' ? 'total = 0.00M  used = 0.00M' : '1')).swapMb).toBe(0);
	});
});
