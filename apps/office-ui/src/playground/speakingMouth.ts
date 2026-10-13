// speakingMouth.ts — which mouth a speaking figure shows at a tick of the 24 ticks per second: syllables of half and
// fully open mouths between closed ones, five syllables in about a second, then a short pause before the round
// starts again.
import { FacePart } from '@pixecutive/protocol';

/** One round of speech: each mouth with the ticks it is held. */
const round: readonly (readonly [FacePart, number])[] = Object.freeze([
	[FacePart.Mouth, 1],
	[FacePart.MouthOpen, 3],
	[FacePart.MouthHalf, 2],
	[FacePart.Mouth, 1],
	[FacePart.MouthHalf, 2],
	[FacePart.MouthOpen, 2],
	[FacePart.Mouth, 2],
	[FacePart.MouthOpen, 3],
	[FacePart.MouthHalf, 1],
	[FacePart.Mouth, 1],
	[FacePart.MouthHalf, 3],
	[FacePart.Mouth, 1],
	[FacePart.MouthOpen, 2],
	[FacePart.MouthHalf, 2],
	[FacePart.Mouth, 6],
]);
const length = round.reduce((sum, [, ticks]) => sum + ticks, 0);

/** The mouth at `tick` (any whole number, also before 0), going round after the pause. */
export function speakingMouth(tick: number): FacePart {
	let left = ((tick % length) + length) % length;
	for (const [mouth, ticks] of round) {
		if (left < ticks) return mouth;
		left -= ticks;
	}
	return FacePart.Mouth;
}
