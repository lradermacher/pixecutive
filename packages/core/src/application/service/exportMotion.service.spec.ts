import { describe, expect, it } from 'vitest';
import { type ExportConfig, exportConfigSchema } from '../../domain/Figure/exportConfig.schema.ts';
import { FacePart } from '../../domain/Figure/facePart.enum.ts';
import type { FaceSource } from '../../domain/Figure/faceSource.interface.ts';
import { FigureName } from '../../domain/Figure/figureName.enum.ts';
import type { FramePlan } from '../../domain/Figure/framePlan.schema.ts';
import { HeadPartKind } from '../../domain/Figure/headPartKind.enum.ts';
import type { HeadPartSource } from '../../domain/Figure/headPartSource.interface.ts';
import { Motion } from '../../domain/Figure/motion.enum.ts';
import type { FacePlacement, HeadPlacement, MotionAsset } from '../../domain/Figure/motionAsset.interface.ts';
import type { IAssetStore } from '../../port/outgoing/assetStore.interface.ts';
import { FigureException } from '../exception/figure.exception.ts';
import { FigureExceptionKey } from '../exception/figureExceptionKey.enum.ts';
import { ExportMotionService } from './exportMotion.service.ts';
import type { ExportMotionCommand } from './exportMotionCommand.ts';

/** Keeps what it was asked to store and names files after figure, motion and position. */
class InMemoryAssetStore implements IAssetStore {
	readonly frames: string[][] = [];
	readonly scales: number[] = [];
	readonly motions: [FigureName, Motion, MotionAsset][] = [];

	putFrames(
		figure: FigureName,
		motion: Motion,
		sprites: readonly string[],
		values: ExportConfig,
	): Promise<{ files: string[]; width: number; height: number }> {
		this.frames.push([...sprites, `background ${values.edge.background.join(',')}`]);
		return Promise.resolve({
			files: sprites.map((_, k) => `${figure}/body/${motion}/${String(k).padStart(2, '0')}.png`),
			width: 89,
			height: 201,
		});
	}

	putFace(
		figure: FigureName,
		motion: Motion,
		sources: readonly FaceSource[],
		scale: number,
		values: ExportConfig,
	): Promise<FacePlacement[]> {
		this.scales.push(values.face.cropBefore === 2 ? scale : -1);
		return Promise.resolve(
			sources.map((s): FacePlacement => ({
				part: s.part,
				file: `${figure}/face/${motion}/${s.part}.png`,
				x: 1,
				y: 2,
				width: 3,
				height: 4,
			})),
		);
	}

	putMotion(figure: FigureName, motion: Motion, asset: MotionAsset): Promise<void> {
		this.motions.push([figure, motion, asset]);
		return Promise.resolve();
	}
	readonly heads: [FigureName, Motion, HeadPartSource[], number][] = [];
	readonly figureHeads: [FigureName, { lift: Readonly<Record<string, number>>; openTop: readonly number[] }][] = [];

	putHead(
		figure: FigureName,
		motion: Motion,
		sources: readonly HeadPartSource[],
		scale: number,
	): Promise<HeadPlacement[]> {
		this.heads.push([figure, motion, [...sources], scale]);
		return Promise.resolve(
			sources.map((s) => ({
				kind: s.kind,
				id: s.id,
				file: `${figure}/head/${motion}/${s.kind}-${String(s.id)}.png`,
				x: 1,
				y: 2,
				width: 3,
				height: 4,
			})),
		);
	}

	putFigureHead(
		figure: FigureName,
		head: { lift: Readonly<Record<string, number>>; openTop: readonly number[] },
	): Promise<void> {
		this.figureHeads.push([figure, head]);
		return Promise.resolve();
	}
}

const values = exportConfigSchema.parse({});
const plan: FramePlan = {
	sprites: [0, 1, 2, 3, 4].map((source) => ({ source, hold: source + 1, shiftX: 0, shiftY: 0 })),
	margin: { top: 2, bottom: 0, left: 2, right: 2 },
	height: 200,
	driftPerVideoFrame: 7.5,
};
const command: ExportMotionCommand = {
	figure: FigureName.M,
	motion: Motion.Idle,
	plan,
	cut: { frames: ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'], scale: 0.3, width: 89, height: 201 },
	use: { first: 1, last: 3 },
	track: {
		scale: 0.345,
		origin: [
			[1, 1],
			[2, 2],
			[3, 3],
		],
		earOffset: [0, 0, 0],
	},
	face: [
		{ part: FacePart.Blank, image: 'blank.png', mask: 'mask.png' },
		{ part: FacePart.Mouth, image: 'mouth.png' },
	],
	values,
};

const failureKey = (run: Promise<unknown>): Promise<unknown> =>
	run.then(
		() => null,
		(error: unknown) => (error instanceof FigureException ? error.key : error),
	);

describe('ExportMotionService', () => {
	it('stores the used sprites with their holds, the face at the track scale and records the motion', async () => {
		const store = new InMemoryAssetStore();
		const asset = await new ExportMotionService(store).export(command);
		expect(store.frames).toEqual([['b.png', 'c.png', 'd.png', 'background 186,212,226']]);
		expect(store.scales).toEqual([0.345]);
		expect(asset.frames).toEqual([
			{ file: 'm/body/idle/00.png', hold: 2 },
			{ file: 'm/body/idle/01.png', hold: 3 },
			{ file: 'm/body/idle/02.png', hold: 4 },
		]);
		expect([asset.width, asset.height, asset.advance, asset.head.scale]).toEqual([89, 201, 2.25, 0.345]);
		expect(asset.face.map((p) => p.part)).toEqual([FacePart.Blank, FacePart.Mouth]);
		expect(store.motions).toEqual([[FigureName.M, Motion.Idle, asset]]);
	});

	it('uses every sprite when no range is given', async () => {
		const store = new InMemoryAssetStore();
		const track = {
			scale: 0.345,
			origin: plan.sprites.map((): [number, number] => [0, 0]),
			earOffset: [0, 0, 0, 0, 0],
		};
		await new ExportMotionService(store).export({ ...command, use: undefined, track });
		expect(store.frames[0]?.length).toBe(6);
	});

	it.each([
		['a range beyond the sprites', { ...command, use: { first: 3, last: 7 } }],
		['a head track of other frames', { ...command, use: { first: 0, last: 4 } }],
	])('refuses %s with the invalid job key before storing anything', async (_, invalid) => {
		const store = new InMemoryAssetStore();
		expect(await failureKey(new ExportMotionService(store).export(invalid))).toBe(FigureExceptionKey.InvalidJob);
		expect(store.frames).toEqual([]);
	});

	it('stores the head parts at the track scale, puts them into the motion and records the figure head', async () => {
		const store = new InMemoryAssetStore();
		const head: HeadPartSource[] = [
			{ kind: HeadPartKind.Hair, id: 1, image: 'layers/hair-1.png' },
			{ kind: HeadPartKind.Hat, id: 4, image: 'layers/hat-4.png', hide: 'layers/hat-4-hide.png' },
		];
		const figureHead = { lift: { '1': 12 }, openTop: [12] };
		const asset = await new ExportMotionService(store).export({ ...command, head, figureHead });
		expect([
			store.heads[0]?.[2],
			store.heads[0]?.[3],
			asset.parts?.map((p) => `${p.kind}-${String(p.id)}`),
			store.figureHeads,
		]).toEqual([head, command.track.scale, ['hair-1', 'hat-4'], [[command.figure, figureHead]]]);
	});

	it('leaves the head parts out for a figure without them', async () => {
		const store = new InMemoryAssetStore();
		const asset = await new ExportMotionService(store).export(command);
		expect([store.heads, asset.parts, store.figureHeads]).toEqual([[], undefined, []]);
	});
});
