// drawFigure.ts — assembles one figure at sprite size: the body frame, then the face parts on its head origin, scaled
// smoothly, since their boxes have fractional sizes that nearest pixels would bend; the page zooms the result crisp.
import { facePlaced } from './facePlaced.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';

/** What the assembly needs of a 2D canvas; `CanvasRenderingContext2D` is one. */
export interface SpriteCanvas<Image> {
	imageSmoothingEnabled: boolean;
	setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
	clearRect(x: number, y: number, width: number, height: number): void;
	drawImage(image: Image, x: number, y: number, width: number, height: number): void;
}

/** Draws frame `frame` of the motion `name`; an image not loaded yet is left out. */
export function drawFigure<Image>(
	canvas: SpriteCanvas<Image>,
	image: (file: string) => Image | undefined,
	name: string,
	motion: ManifestMotion,
	frame: number,
): void {
	canvas.setTransform(1, 0, 0, 1, 0, 0);
	canvas.clearRect(0, 0, motion.width, motion.height);
	canvas.imageSmoothingEnabled = true;
	const body = image(motion.frames[frame]?.file ?? '');
	if (body !== undefined) canvas.drawImage(body, 0, 0, motion.width, motion.height);
	for (const part of facePlaced(name, motion, frame)) {
		const drawn = image(part.file);
		if (drawn !== undefined) canvas.drawImage(drawn, part.x, part.y, part.width, part.height);
	}
}
