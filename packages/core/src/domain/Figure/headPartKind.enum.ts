// headPartKind.enum.ts — the kinds of parts drawn on a figure's head, each in variants; the values are the protocol's.

/** A kind of head part; its value names the part's asset files. */
export enum HeadPartKind {
	Hair = 'hair',
	Beard = 'beard',
	Hat = 'hat',
	Glasses = 'glasses',
	/** Hair redrawn to fit under the beanie, so a hat sits on it without the hair showing through. */
	HairUnderHat = 'hair-under-hat',
	Brows = 'brows',
	Eyes = 'eyes',
	Nose = 'nose',
	Mouth = 'mouth',
}
