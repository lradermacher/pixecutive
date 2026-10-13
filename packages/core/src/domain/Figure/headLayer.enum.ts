// headLayer.enum.ts — the layers drawn over the face parts, in the order they are drawn; the values are the protocol's.

/**
 * A layer over the face, back to front: the beard, the hat's hide that cuts the head away where the hat replaces
 * it, the hair (or the hair under the hat), the glasses over the hair and the hat over the glasses.
 */
export enum HeadLayer {
	Beard = 'beard',
	HatHide = 'hat-hide',
	Hair = 'hair',
	Glasses = 'glasses',
	Hat = 'hat',
}
