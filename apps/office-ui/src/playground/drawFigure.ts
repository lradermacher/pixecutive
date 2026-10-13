// drawFigure.ts — assembles one figure at sprite size: the body frame, then the face and head parts on its head
// origin, scaled smoothly, since their boxes have fractional sizes that nearest pixels would bend; a hat's hide cuts
// the head away. The page zooms the result crisp.
import type { FacePart, FigureManifest } from '@pixecutive/protocol';
import { facePlaced } from './facePlaced.ts';
import { headPlaced } from './headPlaced.ts';
import type { Look } from './look.interface.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';

/** What the assembly needs of a 2D canvas; `CanvasRenderingContext2D` is one. */
export interface SpriteCanvas<Image> {
	imageSmoothingEnabled: boolean;
	/** `destination-out` takes a drawn image's pixels out of the figure; `source-over` draws over it. */
	globalCompositeOperation: string;
	setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
	clearRect(x: number, y: number, width: number, height: number): void;
	drawImage(image: Image, x: number, y: number, width: number, height: number): void;
}

/**
 * Draws frame `frame` of the motion `name` with the mouth `mouth` and the head parts of `look`; an image not loaded
 * yet is left out.
 */
export function drawFigure<Image>(
	canvas: SpriteCanvas<Image>,
	image: (file: string) => Image | undefined,
	name: string,
	motion: ManifestMotion,
	frame: number,
	mouth?: FacePart,
	look: Look = {},
	head?: FigureManifest['figures'][string]['head'],
): void {
	canvas.setTransform(1, 0, 0, 1, 0, 0);
	canvas.clearRect(0, 0, motion.width, motion.height);
	canvas.imageSmoothingEnabled = true;
	const body = image(motion.frames[frame]?.file ?? '');
	if (body !== undefined) canvas.drawImage(body, 0, 0, motion.width, motion.height);
	for (const part of facePlaced(name, motion, frame, mouth, look)) {
		const drawn = image(part.file);
		if (drawn !== undefined) canvas.drawImage(drawn, part.x, part.y, part.width, part.height);
	}
	for (const layer of headPlaced(motion, frame, head, look)) {
		const drawn = image(layer.file);
		if (drawn === undefined) continue;
		canvas.globalCompositeOperation = layer.cut ? 'destination-out' : 'source-over';
		canvas.drawImage(drawn, layer.x, layer.y, layer.width, layer.height);
	}
	canvas.globalCompositeOperation = 'source-over';
}
