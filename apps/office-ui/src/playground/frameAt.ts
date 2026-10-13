// frameAt.ts — which sprite frame of a motion shows at a tick of the 24 ticks per second, each frame held for its
// hold in ticks.
import { Playback } from './playback.enum.ts';

/** The frame order of one round: forward, or forward and back without repeating the two ends. */
function order(count: number, playback: Playback): number[] {
	const forward = Array.from({ length: count }, (_, k) => k);
	return playback === Playback.BackAndForth ? [...forward, ...forward.slice(1, -1).reverse()] : forward;
}

/** The frame at `tick` (any whole number, also before 0), going round after the last frame. */
export function frameAt(holds: readonly number[], tick: number, playback: Playback): number {
	const round = order(holds.length, playback);
	const length = round.reduce((sum, frame) => sum + (holds[frame] ?? 1), 0);
	let left = ((tick % length) + length) % length;
	for (const frame of round) {
		const hold = holds[frame] ?? 1;
		if (left < hold) return frame;
		left -= hold;
	}
	return 0;
}
