// motion.enum.ts — the motions a base figure has, each with its own sprite frames; speaking is no motion but the
// mouth's states on any of them.

/** A motion of a figure; its value names its asset folder. */
export enum Motion {
	Idle = 'idle',
	Walk = 'walk',
	Wave = 'wave',
	Sit = 'sit',
	Type = 'type',
}
