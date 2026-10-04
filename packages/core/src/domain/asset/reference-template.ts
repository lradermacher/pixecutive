// reference-template.ts — what the image model must deliver for every figure: views, pose, background, size.
import type { View } from './view.ts';

/**
 * The fixed frame of every reference render. `prompt` is the base text; the figure's feature sentences are inserted
 * where `{features}` stands, so every figure gets the same views, pose and flat key-colored background.
 */
export interface ReferenceTemplate {
	readonly views: readonly View[];
	readonly prompt: string;
	readonly width: number;
	readonly height: number;
	readonly seed: number;
	readonly keyColor: string;
}
