import { describe, expect, it } from 'vitest';
import { frameAt } from './frameAt.ts';
import { Playback } from './playback.enum.ts';

describe('frameAt', () => {
	it('holds each frame for its hold in ticks and goes round after the last', () => {
		const holds = [2, 1, 3];
		const ticks = Array.from({ length: 8 }, (_, tick) => frameAt(holds, tick, Playback.Loop));
		expect(ticks).toEqual([0, 0, 1, 2, 2, 2, 0, 0]);
	});

	it('plays forward and back without repeating the ends', () => {
		const ticks = Array.from({ length: 9 }, (_, tick) => frameAt([1, 1, 1, 1], tick, Playback.BackAndForth));
		expect(ticks).toEqual([0, 1, 2, 3, 2, 1, 0, 1, 2]);
	});

	it('keeps the holds on the way back', () => {
		const ticks = Array.from({ length: 6 }, (_, tick) => frameAt([1, 2, 1], tick, Playback.BackAndForth));
		expect(ticks).toEqual([0, 1, 1, 2, 1, 1]);
	});

	it('plays a single frame and a pair the same either way, and takes a tick before 0 from the end', () => {
		expect([
			frameAt([3], 7, Playback.BackAndForth),
			frameAt([1, 1], 3, Playback.BackAndForth),
			frameAt([1, 1, 2], -1, Playback.Loop),
		]).toEqual([0, 1, 2]);
	});
});
