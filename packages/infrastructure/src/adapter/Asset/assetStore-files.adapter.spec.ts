import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
	exportConfigSchema,
	FacePart,
	FigureException,
	FigureExceptionKey,
	FigureName,
	Motion,
	type MotionAsset,
} from '@pixecutive/core';
import { figureManifestSchema } from '@pixecutive/protocol';
import { describe, expect, it } from 'vitest';
import { runPythonStep } from '../Python/pythonStep.ts';
import { AssetStoreFilesAdapter } from './assetStore-files.adapter.ts';

const python = { uv: 'uv', project: resolve(import.meta.dirname, '../../..') };
const script = resolve(import.meta.dirname, 'assets.py');
const values = exportConfigSchema.parse({});
/** A real Python start loads OpenCV; under a full parallel test run that takes longer than 5 s. */
const PYTHON_START_MS = 30_000;

/**
 * Two sprites of a dark figure on transparency, a mouth and a blank head with its mask on a still, and one noisy
 * sprite too large for the office; drawn by Python into a temp folder, so no image enters the repo.
 */
async function sources(): Promise<{ dir: string; sprites: string[]; big: string }> {
	const dir = mkdtempSync(join(tmpdir(), 'store-src-'));
	const maker = join(dir, 'make.py');
	writeFileSync(
		maker,
		[
			'import sys, numpy as np',
			'from PIL import Image',
			'd = sys.argv[1]',
			'for k in range(2):',
			'    a = np.zeros((60, 30, 4), np.uint8); a[5:55, 5:25] = (60, 40, 30, 255); a[10:20, 8:22] = (240, 160, 110, 255)',
			'    Image.fromarray(a).save(f"{d}/s{k}.png")',
			'm = np.zeros((400, 300, 4), np.uint8); m[200:230, 120:180] = (150, 40, 40, 255); Image.fromarray(m).save(f"{d}/mouth.png")',
			'Image.fromarray(np.full((400, 300, 3), (240, 160, 110), np.uint8)).save(f"{d}/blank.png")',
			'k = np.zeros((400, 300), np.uint8); k[100:260, 80:220] = 255; Image.fromarray(k).save(f"{d}/mask.png")',
			'Image.fromarray(np.random.default_rng(1).integers(0, 255, (700, 700, 4), dtype=np.uint8)).save(f"{d}/big.png")',
		].join('\n'),
	);
	await runPythonStep(python, maker, [dir]);
	return { dir, sprites: [join(dir, 's0.png'), join(dir, 's1.png')], big: join(dir, 'big.png') };
}

function store(): { adapter: AssetStoreFilesAdapter; root: string; staging: string } {
	const root = mkdtempSync(join(tmpdir(), 'figures-'));
	const staging = mkdtempSync(join(tmpdir(), 'staging-'));
	return { adapter: new AssetStoreFilesAdapter({ python, script, root, staging }), root, staging };
}

/** Puts `content` at `file` under `dir`, creating its folders. */
function place(dir: string, file: string, content = 'png'): void {
	mkdirSync(dirname(join(dir, file)), { recursive: true });
	writeFileSync(join(dir, file), content);
}

const asset = (frames: string[]): MotionAsset => ({
	frames: frames.map((file) => ({ file, hold: 1 })),
	width: 30,
	height: 60,
	advance: 0,
	head: { scale: 0.345, origin: frames.map((): [number, number] => [-48, -36]) },
	face: [{ part: FacePart.Mouth, file: 'm/face/idle/mouth.png', x: 1, y: 2, width: 3, height: 4 }],
});

describe('AssetStoreFilesAdapter staging a motion', () => {
	it(
		'stages the sprites and answers their files as the asset folder will name them, and their size',
		async () => {
			const { adapter, root, staging } = store();
			const { sprites } = await sources();
			const stored = await adapter.putFrames(FigureName.M, Motion.Idle, sprites, values);
			expect(stored).toEqual({ files: ['m/body/idle/00.png', 'm/body/idle/01.png'], width: 30, height: 60 });
			expect([existsSync(join(staging, 'm/body/idle/01.png')), existsSync(join(root, 'm/body'))]).toEqual([
				true,
				false,
			]);
		},
		PYTHON_START_MS,
	);

	it(
		'replaces the frames an earlier export of the motion left once the manifest takes the new ones',
		async () => {
			const { adapter, root } = store();
			place(root, 'm/body/idle/07.png', 'stale');
			const { files } = await adapter.putFrames(FigureName.M, Motion.Idle, (await sources()).sprites, values);
			await adapter.putMotion(FigureName.M, Motion.Idle, { ...asset(files), face: [] });
			expect([existsSync(join(root, 'm/body/idle/07.png')), existsSync(join(root, 'm/body/idle/01.png'))]).toEqual([
				false,
				true,
			]);
		},
		PYTHON_START_MS,
	);

	it(
		'leaves the shipped motion as it was when an export fails before its manifest',
		async () => {
			const { adapter, root } = store();
			place(root, 'm/body/idle/00.png', 'shipped');
			const failure: unknown = await adapter
				.putFrames(FigureName.M, Motion.Idle, [join(root, 'no-such-sprite.png')], values)
				.catch((error: unknown) => error);
			expect([
				failure instanceof FigureException && failure.key,
				readFileSync(join(root, 'm/body/idle/00.png'), 'utf8'),
			]).toEqual([FigureExceptionKey.StorageFailed, 'shipped']);
		},
		PYTHON_START_MS,
	);

	it(
		'scales the face parts and answers where each is drawn',
		async () => {
			const { adapter } = store();
			const { dir } = await sources();
			const placed = await adapter.putFace(
				FigureName.F,
				Motion.Walk,
				[
					{ part: FacePart.Blank, image: join(dir, 'blank.png'), mask: join(dir, 'mask.png') },
					{ part: FacePart.Mouth, image: join(dir, 'mouth.png') },
				],
				0.5,
				values,
			);
			expect(placed.map((p) => [p.part, p.file])).toEqual([
				[FacePart.Blank, 'f/face/walk/blank.png'],
				[FacePart.Mouth, 'f/face/walk/mouth.png'],
			]);
			// the mouth's pixels (rows 200-229, columns 120-179) with the crop margin (2 before, 3 after) at half size
			expect(placed[1]).toMatchObject({ x: 59, y: 99, width: 32, height: 17 });
		},
		PYTHON_START_MS,
	);

	it(
		'refuses a staged file larger than the office allows, naming it, and still exports another motion after it',
		async () => {
			const { adapter, staging } = store();
			const { big, sprites } = await sources();
			const failure: unknown = await adapter
				.putFrames(FigureName.F, Motion.Idle, [big], values)
				.catch((error: unknown) => error);
			expect(failure instanceof FigureException && [failure.key, failure.detail]).toEqual([
				FigureExceptionKey.StorageFailed,
				expect.stringMatching(new RegExp(`^staged ${staging}/f/body/idle/00\\.png has \\d+ bytes$`)),
			]);
			expect((await adapter.putFrames(FigureName.M, Motion.Walk, sprites, values)).files).toHaveLength(2);
		},
		PYTHON_START_MS,
	);
});

describe('AssetStoreFilesAdapter shipping a motion', () => {
	it('records motions in the manifest, keeping the others, in a form the protocol accepts', async () => {
		const { adapter, root, staging } = store();
		for (const file of ['m/body/idle/00.png', 'm/body/walk/00.png', 'm/body/walk/01.png', 'm/face/idle/mouth.png'])
			place(staging, file);
		await adapter.putMotion(FigureName.M, Motion.Idle, asset(['m/body/idle/00.png']));
		await adapter.putMotion(FigureName.M, Motion.Walk, asset(['m/body/walk/00.png', 'm/body/walk/01.png']));
		const manifest = figureManifestSchema.parse(JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')));
		expect(Object.keys(manifest.figures['m']?.motions ?? {})).toEqual(['idle', 'walk']);
		expect(manifest.figures['m']?.motions['walk']?.face['mouth']?.x).toBe(1);
	});

	it('keeps a shipped folder nothing new was staged for', async () => {
		const { adapter, root, staging } = store();
		place(root, 'm/face/idle/mouth.png', 'shipped');
		place(staging, 'm/body/idle/00.png');
		await adapter.putMotion(FigureName.M, Motion.Idle, asset(['m/body/idle/00.png']));
		expect(readFileSync(join(root, 'm/face/idle/mouth.png'), 'utf8')).toBe('shipped');
	});

	it('ships nothing when the manifest would name a file that is not there', async () => {
		const { adapter, root, staging } = store();
		place(staging, 'm/body/idle/00.png', 'new');
		place(root, 'm/body/idle/00.png', 'shipped');
		const failure: unknown = await adapter
			.putMotion(FigureName.M, Motion.Idle, asset(['m/body/idle/00.png', 'm/body/idle/01.png']))
			.catch((error: unknown) => error);
		expect([
			failure instanceof FigureException && failure.key,
			readFileSync(join(root, 'm/body/idle/00.png'), 'utf8'),
		]).toEqual([FigureExceptionKey.StorageFailed, 'shipped']);
	});

	it('refuses a manifest that would name a file that is not there', async () => {
		const { adapter, root } = store();
		const failure: unknown = await adapter
			.putMotion(FigureName.M, Motion.Idle, asset(['m/body/idle/00.png']))
			.catch((error: unknown) => error);
		expect([failure instanceof FigureException && failure.detail, existsSync(join(root, 'manifest.json'))]).toEqual([
			'missing m/body/idle/00.png, m/face/idle/mouth.png',
			false,
		]);
	});

	it('refuses to build on a manifest the protocol refuses', async () => {
		const { adapter, root } = store();
		writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version: 2, figures: {} }));
		const failure: unknown = await adapter
			.putMotion(FigureName.M, Motion.Idle, asset(['m/body/idle/00.png']))
			.catch((error: unknown) => error);
		expect(failure instanceof FigureException && failure.key).toBe(FigureExceptionKey.StorageFailed);
	});
});
