// facePart.enum.ts — the parts of a base figure's face that the office draws over its blank head.

/** A face part; its value names its file under `face/<motion>/`. */
export enum FacePart {
	Blank = 'blank',
	Brows = 'brows',
	Eyes = 'eyes',
	EyesHalf = 'eyes-half',
	EyesClosed = 'eyes-closed',
	Nose = 'nose',
	Mouth = 'mouth',
}
