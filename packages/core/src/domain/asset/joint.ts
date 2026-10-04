// joint.ts — the joints of a figure's armature, as the maintainer decided them (sheet pix57-plan, F3).

/** A joint of the figure armature. Eyes and mouth are swapped as variants, not moved. */
export enum Joint {
	Pelvis = 'pelvis',
	Spine = 'spine',
	Chest = 'chest',
	Neck = 'neck',
	Head = 'head',
	Shoulder = 'shoulder',
	Elbow = 'elbow',
	Wrist = 'wrist',
	Hip = 'hip',
	Knee = 'knee',
	Ankle = 'ankle',
}
