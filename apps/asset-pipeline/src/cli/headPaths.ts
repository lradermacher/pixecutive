// headPaths.ts — where the head-part commands leave their work in the renders folder: the grids for the image model,
// its drawings, one still per variant, and the cut layers the export reads.
import { join } from 'node:path';
import type { FigureName, HeadPartKind } from '@pixecutive/core';

/** The files of one figure's head parts under `renders/head/<figure>/`. */
export interface HeadPaths {
	grid(name: string): string;
	drawing(kind: HeadPartKind, draw: number): string;
	still(kind: HeadPartKind, id: number): string;
	underHatInput(id: number): string;
	layer(kind: HeadPartKind, id: number): string;
	hide(id: number): string;
}

/** The head-part files of `figure` under `rendersDir`. */
export function headPaths(rendersDir: string, figure: FigureName): HeadPaths {
	const root = join(rendersDir, 'head', figure);
	return {
		grid: (name) => join(root, `grid-${name}.png`),
		drawing: (kind, draw) => join(root, kind, `drawing-${String(draw)}.png`),
		still: (kind, id) => join(root, kind, `${String(id)}.png`),
		underHatInput: (id) => join(root, 'hair-under-hat', `input-${String(id)}.png`),
		layer: (kind, id) => join(root, 'layers', `${kind}-${String(id)}.png`),
		hide: (id) => join(root, 'layers', `hat-${String(id)}-hide.png`),
	};
}
