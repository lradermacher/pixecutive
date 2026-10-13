// headParts.service.ts — what the core decides about head parts without touching a file: which part of a grid image
// each drawing is, and how far a hat rises above the bald head for the hair under it.
import type { GridLayout } from '../../domain/Figure/gridLayout.schema.ts';
import type { StillBox } from '../../domain/Figure/stillBox.schema.ts';

/** The pure decisions of the head-part commands. */
export class HeadPartsService {
	/**
	 * The box of cell `index` in the grid image, left to right, then top to bottom: cells start at the evenly split,
	 * rounded positions and all have the same size, so three cells of a 1024 image start at 0, 341 and 683 and are
	 * 341 wide, and the line at 682 belongs to none.
	 */
	cell(grid: GridLayout, index: number): StillBox {
		const column = index % grid.columns;
		const row = Math.floor(index / grid.columns);
		const left = Math.round((column * grid.width) / grid.columns);
		const top = Math.round((row * grid.height) / grid.rows);
		const width = Math.floor(grid.width / grid.columns);
		const height = Math.floor(grid.height / grid.rows);
		return { left, top, right: left + width, bottom: top + height };
	}

	/** How many cells the grid holds. */
	cells(grid: GridLayout): number {
		return grid.columns * grid.rows;
	}

	/**
	 * How far a hat rises for hair whose first drawn row is `firstRow`, on a figure whose bald skull starts at
	 * `skullTop`: the hair's height above the skull, never below the skull and never more than `most`.
	 */
	lift(skullTop: number, firstRow: number, most: number): number {
		return Math.min(most, Math.max(0, skullTop - firstRow));
	}
}
