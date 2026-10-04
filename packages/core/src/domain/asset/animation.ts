// animation.ts — the animations a figure has, as the maintainer decided them (sheet pix57-plan, F3).

/** An animation of a figure; each is rendered per direction into its own sprite sheet. */
export enum Animation {
	Idle = 'idle',
	Walk = 'walk',
	Talk = 'talk',
	Sit = 'sit',
	Type = 'type',
	Wave = 'wave',
}
