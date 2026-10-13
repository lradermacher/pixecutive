import {
	ClipMode,
	type CutFrames,
	type ExportConfig,
	ExportMotionService,
	exportConfigSchema,
	FacePart,
	type FacePlacement,
	type FaceSource,
	type FigureName,
	type HeadTrack,
	type IAssetStore,
	type IMotionWork,
	type Motion,
	type MotionAsset,
} from '@pixecutive/core';
import { describe, expect, it } from 'vitest';
import type { FigureSetup } from '../figureConfig.ts';
import { exportMotionHandler } from './exportMotion.handler.ts';

/** Keeps the face sources and the motions it is asked to store. */
class InMemoryAssetStore implements IAssetStore {
	readonly faces: FaceSource[][] = [];
	readonly motions: MotionAsset[] = [];
	putFrames(
		figure: FigureName,
		motion: Motion,
		sprites: readonly string[],
		values: ExportConfig,
	): Promise<{ files: string[]; width: number; height: number }> {
		return Promise.resolve({
			files: sprites.map((_, k) => `${figure}/body/${motion}/0${String(k)}.png`),
			width: values.edge.innerReach,
			height: 201,
		});
	}
	putFace(figure: FigureName, motion: Motion, sources: readonly FaceSource[], scale: number): Promise<FacePlacement[]> {
		this.faces.push([...sources]);
		return Promise.resolve(
			sources.map((s) => ({
				part: s.part,
				file: `${figure}/face/${motion}/${s.part}.png`,
				x: scale,
				y: 0,
				width: 1,
				height: 1,
			})),
		);
	}
	putMotion(_figure: FigureName, _motion: Motion, asset: MotionAsset): Promise<void> {
		this.motions.push(asset);
		return Promise.resolve();
	}
}

/** Holds a cut of three sprites and the track of the two used ones. */
class InMemoryMotionWork implements IMotionWork {
	saveCut(): Promise<void> {
		return Promise.resolve();
	}
	loadCut(): Promise<CutFrames> {
		const sprites = [0, 1, 2].map((source) => ({ source, hold: source + 1, shiftX: 0, shiftY: 0 }));
		const plan = { sprites, margin: { top: 2, bottom: 0, left: 2, right: 2 }, height: 200, driftPerVideoFrame: 10 };
		return Promise.resolve({
			plan,
			result: { frames: ['a.png', 'b.png', 'c.png'], scale: 0.3, width: 90, height: 201 },
		});
	}
	saveTrack(): Promise<void> {
		return Promise.resolve();
	}
	loadTrack(): Promise<HeadTrack> {
		return Promise.resolve({
			scale: 0.345,
			origin: [
				[1, 1],
				[2, 2],
			],
			earOffset: [0, 0],
		});
	}
}

const walk = {
	mode: ClipMode.Cycle,
	frames: 49,
	endStrength: 1,
	prompt: 'p.txt',
	still: 's.png',
	use: { first: 1, last: 2 },
	trackStill: 'o.png',
};
const setup = {
	sources: '/src',
	assets: '/repo/apps/office-ui/assets/figures',
	figures: {
		m: {
			ear: { left: 1, top: 1, right: 9, bottom: 9 },
			face: { mouth: { image: 'm/part_mouth.png' }, blank: { image: 'm/blank2.png', mask: 'm/blank2_mask.png' } },
			motions: { walk },
		},
	},
	export: exportConfigSchema.parse({}),
} as unknown as FigureSetup;

describe('exportMotionHandler', () => {
	it('exports the used sprites with the face parts in the protocol order and answers the asset folder', async () => {
		const store = new InMemoryAssetStore();
		const lines = await exportMotionHandler(
			['m', 'walk'],
			setup,
			new ExportMotionService(store),
			new InMemoryMotionWork(),
		);
		expect(store.faces).toEqual([
			[
				{ part: FacePart.Blank, image: '/src/m/blank2.png', mask: '/src/m/blank2_mask.png' },
				{ part: FacePart.Mouth, image: '/src/m/part_mouth.png' },
			],
		]);
		expect(store.motions[0]?.frames.map((f) => f.hold)).toEqual([2, 3]);
		expect(store.motions[0]?.advance).toBe(3);
		expect(lines).toEqual(['exported m walk: 2 frames, 2 face parts', '/repo/apps/office-ui/assets/figures']);
	});
});
