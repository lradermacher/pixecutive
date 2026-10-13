import { describe, expect, it } from 'vitest';
import { judgeMemory } from './judgeMemory.ts';
import { MemoryAction } from './memoryAction.enum.ts';

describe('judgeMemory', () => {
	it('refuses a start at warning pressure and lets a normal start go', () => {
		expect(judgeMemory(false, 2, 0).action).toBe(MemoryAction.Refuse);
		expect(judgeMemory(false, 1, 0).action).toBe(MemoryAction.Go);
	});

	it('lets a running render go on at warning pressure', () => {
		expect(judgeMemory(true, 2, 100).action).toBe(MemoryAction.Go);
	});

	it('aborts at critical pressure and above the swap limit, naming why', () => {
		expect(judgeMemory(true, 4, 0)).toEqual({ action: MemoryAction.Abort, reason: 'memory pressure level 4' });
		expect(judgeMemory(true, 1, 16385).reason).toBe('swap +16385 MB over the 16384 MB limit');
		expect(judgeMemory(true, 2, 9553).action).toBe(MemoryAction.Go);
	});
});
