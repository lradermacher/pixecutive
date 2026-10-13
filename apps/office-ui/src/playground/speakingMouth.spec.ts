import { FacePart } from '@pixecutive/protocol';
import { describe, expect, it } from 'vitest';
import { speakingMouth } from './speakingMouth.ts';

/** The syllables in a run of mouths: each opening from a closed mouth. */
const syllables = (mouths: FacePart[]): number =>
	mouths.filter((mouth, k) => mouth !== FacePart.Mouth && (k === 0 || mouths[k - 1] === FacePart.Mouth)).length;

describe('speakingMouth', () => {
	it('opens the mouth half and fully in syllables, holding each for its ticks', () => {
		expect(Array.from({ length: 8 }, (_, tick) => speakingMouth(tick))).toEqual([
			FacePart.Mouth,
			FacePart.MouthOpen,
			FacePart.MouthOpen,
			FacePart.MouthOpen,
			FacePart.MouthHalf,
			FacePart.MouthHalf,
			FacePart.Mouth,
			FacePart.MouthHalf,
		]);
	});

	it('speaks five syllables in the 26 ticks before a pause of 6, as fast as people speak', () => {
		const round = Array.from({ length: 32 }, (_, tick) => speakingMouth(tick));
		expect([syllables(round.slice(0, 26)), round.slice(26)]).toEqual([
			5,
			Array.from({ length: 6 }, () => FacePart.Mouth),
		]);
	});

	it('starts the round again after 32 ticks, also from a tick before 0', () => {
		expect([speakingMouth(33), speakingMouth(-1), speakingMouth(-31)]).toEqual([
			FacePart.MouthOpen,
			FacePart.Mouth,
			FacePart.MouthOpen,
		]);
	});
});
