// assetStore-files.adapter.ts — writes a figure's office assets: sprites with cleaned edges, face and head parts at a
// motion's scale (by the Python pixel step beside it), staged outside the asset folder and shipped only with the
// manifest the protocol's schema accepts, so a failed export leaves the office's assets as they were.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
	type ExportConfig,
	FacePart,
	type FacePlacement,
	type FaceSource,
	FigureException,
	FigureExceptionKey,
	type FigureName,
	HeadPartKind,
	type HeadPartSource,
	type HeadPlacement,
	type IAssetStore,
	type Motion,
	type MotionAsset,
	type Placement,
} from '@pixecutive/core';
import {
	FacePart as WireFacePart,
	type FigureManifest,
	figureManifestSchema,
	HeadPartKind as WireHeadPartKind,
} from '@pixecutive/protocol';
import { type AnswerSchema, pixelStep } from '../Python/pixelStep.ts';
import type { PythonScriptConfig } from '../Python/pythonStep.ts';

/** The office's limit for one asset file (ops rule): 256 KB. */
const fileLimitBytes = 256 * 1024;

/** The face parts as the wire names them; a new part fails the type check until it has its wire name. */
const wirePart: Readonly<Record<FacePart, WireFacePart>> = Object.freeze({
	[FacePart.Blank]: WireFacePart.Blank,
	[FacePart.Brows]: WireFacePart.Brows,
	[FacePart.Eyes]: WireFacePart.Eyes,
	[FacePart.EyesHalf]: WireFacePart.EyesHalf,
	[FacePart.EyesClosed]: WireFacePart.EyesClosed,
	[FacePart.Nose]: WireFacePart.Nose,
	[FacePart.Mouth]: WireFacePart.Mouth,
	[FacePart.MouthHalf]: WireFacePart.MouthHalf,
	[FacePart.MouthOpen]: WireFacePart.MouthOpen,
});

/** The head part kinds as the wire names them; a new kind fails the type check until it has its wire name. */
const wireKind: Readonly<Record<HeadPartKind, WireHeadPartKind>> = Object.freeze({
	[HeadPartKind.Hair]: WireHeadPartKind.Hair,
	[HeadPartKind.Beard]: WireHeadPartKind.Beard,
	[HeadPartKind.Hat]: WireHeadPartKind.Hat,
	[HeadPartKind.Glasses]: WireHeadPartKind.Glasses,
	[HeadPartKind.HairUnderHat]: WireHeadPartKind.HairUnderHat,
	[HeadPartKind.Brows]: WireHeadPartKind.Brows,
	[HeadPartKind.Eyes]: WireHeadPartKind.Eyes,
	[HeadPartKind.Nose]: WireHeadPartKind.Nose,
	[HeadPartKind.Mouth]: WireHeadPartKind.Mouth,
});

/** Where the figures' assets go and the Python step that cleans and scales them. */
export interface AssetStoreConfig extends PythonScriptConfig {
	/** `apps/office-ui/assets/figures` of the repo. */
	readonly root: string;
	/** A folder outside the asset folder where an export is written before it replaces the shipped motion. */
	readonly staging: string;
}

/** The folders one motion of one figure fills: its sprites, its face parts and its head parts. */
const motionFolders = (figure: FigureName, motion: Motion): string[] => [
	join(figure, 'body', motion),
	join(figure, 'face', motion),
	join(figure, 'head', motion),
];

/** A placement as the manifest holds it. */
const placed = (p: Placement): Placement => ({ file: p.file, x: p.x, y: p.y, width: p.width, height: p.height });

/** One motion as the manifest holds it: the face parts and head parts under their wire names. */
function manifestEntry(asset: MotionAsset): FigureManifest['figures'][string]['motions'][string] {
	const face: FigureManifest['figures'][string]['motions'][string]['face'] = {};
	for (const p of asset.face) face[wirePart[p.part]] = placed(p);
	const parts: NonNullable<FigureManifest['figures'][string]['motions'][string]['parts']> = {};
	for (const p of asset.parts ?? []) {
		const kind = (parts[wireKind[p.kind]] ??= {});
		kind[String(p.id)] = { ...placed(p), ...(p.hide ? { hide: placed(p.hide) } : {}) };
	}
	return {
		frames: asset.frames.map((f) => ({ file: f.file, hold: f.hold })),
		width: asset.width,
		height: asset.height,
		advance: asset.advance,
		head: { scale: asset.head.scale, origin: asset.head.origin.map(([x, y]): [number, number] => [x, y]) },
		face,
		...(asset.parts && asset.parts.length > 0 ? { parts } : {}),
	};
}

/** The pixel step's answer to `clean`: the files it wrote. */
const writtenFiles: AnswerSchema<string[]> = {
	safeParse: (data) =>
		Array.isArray(data) && data.every((item) => typeof item === 'string')
			? { success: true, data: data }
			: { success: false, error: { issues: [{ path: [], message: 'a list of written files' }] } },
};

/** The pixel step's answer to `face`: where each part is drawn. */
const placedParts: AnswerSchema<{ part: string; file: string; x: number; y: number; width: number; height: number }[]> =
	{
		safeParse: (data) => {
			const ok =
				Array.isArray(data) &&
				data.every(
					(p: unknown) =>
						typeof p === 'object' &&
						p !== null &&
						['x', 'y', 'width', 'height'].every((k) => typeof (p as Record<string, unknown>)[k] === 'number') &&
						typeof (p as Record<string, unknown>)['file'] === 'string',
				);
			return ok
				? {
						success: true,
						data: data as { part: string; file: string; x: number; y: number; width: number; height: number }[],
					}
				: { success: false, error: { issues: [{ path: [], message: 'a list of placed parts' }] } };
		},
	};

/**
 * Runs one step on the asset folder and names a failure with the storage key.
 * @throws {FigureException} the storage key with the step and the file system's message.
 */
function onDisk<T>(what: string, step: () => T): T {
	try {
		return step();
	} catch (failure) {
		throw new FigureException(FigureExceptionKey.StorageFailed, `${what}: ${(failure as Error).message}`);
	}
}

/** The width and height a PNG file declares in its header. */
function pngSize(path: string): [number, number] {
	const head = onDisk(`read ${path}`, () => readFileSync(path));
	return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

/**
 * The asset folder of the office.
 * @throws {FigureException} from every method: the storage key when a file cannot be written or grows past 256 KB,
 * the storage key when the existing manifest is not one the protocol accepts.
 */
export class AssetStoreFilesAdapter implements IAssetStore {
	constructor(private readonly config: AssetStoreConfig) {}

	/** Writes `<figure>/body/<motion>/NN.png`, replacing the motion's earlier frames. */
	async putFrames(
		figure: FigureName,
		motion: Motion,
		sprites: readonly string[],
		values: ExportConfig,
	): Promise<{ files: string[]; width: number; height: number }> {
		const folder = this.fresh(join(figure, 'body', motion));
		const pairs = sprites.map((sprite, k) => [sprite, join(folder, `${String(k).padStart(2, '0')}.png`)]);
		const written = await this.step(
			['clean', JSON.stringify(pairs), JSON.stringify(values.edge)],
			writtenFiles,
			folder,
		);
		const [width, height] = pngSize(written[0] ?? '');
		return { files: written.map((file) => this.within(file)), width, height };
	}

	/** Writes `<figure>/face/<motion>/<part>.png` scaled by `scale`; the blank head gets its edge cleaned like a sprite. */
	async putFace(
		figure: FigureName,
		motion: Motion,
		sources: readonly FaceSource[],
		scale: number,
		values: ExportConfig,
	): Promise<FacePlacement[]> {
		const folder = this.fresh(join(figure, 'face', motion));
		const parts = sources.map((source) => ({ ...source, out: join(folder, `${source.part}.png`) }));
		const placed = await this.step(
			['face', JSON.stringify(parts), String(scale), JSON.stringify(values.face)],
			placedParts,
			folder,
		);
		const blank = parts.find((p) => p.part === FacePart.Blank);
		if (blank)
			await this.step(
				['clean', JSON.stringify([[blank.out, blank.out]]), JSON.stringify(values.edge)],
				writtenFiles,
				folder,
			);
		return placed.map((p, k) => ({
			part: sources[k]?.part ?? FacePart.Blank,
			file: this.within(p.file),
			x: p.x,
			y: p.y,
			width: p.width,
			height: p.height,
		}));
	}

	/** Writes `<figure>/head/<motion>/<kind>-<id>.png`, and a hat's `hat-<id>-hide.png`, scaled by `scale`. */
	async putHead(
		figure: FigureName,
		motion: Motion,
		sources: readonly HeadPartSource[],
		scale: number,
		values: ExportConfig,
	): Promise<HeadPlacement[]> {
		const folder = this.fresh(join(figure, 'head', motion));
		const entries = sources.flatMap((source) => {
			const name = `${source.kind}-${String(source.id)}`;
			return [
				{ part: name, image: source.image, out: join(folder, `${name}.png`) },
				...(source.hide === undefined
					? []
					: [{ part: `${name}-hide`, image: source.hide, out: join(folder, `${name}-hide.png`) }]),
			];
		});
		const answers = await this.step(
			['face', JSON.stringify(entries), String(scale), JSON.stringify(values.face)],
			placedParts,
			folder,
		);
		const at = (out: string): Placement => {
			const p = answers[entries.findIndex((entry) => entry.out === out)];
			if (p === undefined) throw new FigureException(FigureExceptionKey.StorageFailed, `no placement for ${out}`);
			return { file: this.within(p.file), x: p.x, y: p.y, width: p.width, height: p.height };
		};
		return sources.map((source) => {
			const base = join(folder, `${source.kind}-${String(source.id)}`);
			return {
				kind: source.kind,
				id: source.id,
				...at(`${base}.png`),
				...(source.hide === undefined ? {} : { hide: at(`${base}-hide.png`) }),
			};
		});
	}

	/** Puts the lift per hairstyle and the open hats under the figure in `manifest.json`, keeping its motions. */
	putFigureHead(
		figure: FigureName,
		head: { lift: Readonly<Record<string, number>>; openTop: readonly number[] },
	): Promise<void> {
		return new Promise((resolve) => {
			const path = join(this.config.root, 'manifest.json');
			const before: FigureManifest = existsSync(path) ? this.read(path) : { version: 1, figures: {} };
			const motions = before.figures[figure]?.motions ?? {};
			const after = figureManifestSchema.safeParse({
				...before,
				figures: {
					...before.figures,
					[figure]: { head: { lift: { ...head.lift }, openTop: [...head.openTop] }, motions },
				},
			});
			if (!after.success)
				throw new FigureException(FigureExceptionKey.StorageFailed, `manifest: ${after.error.message}`);
			onDisk('write the manifest', () => {
				writeFileSync(path, `${JSON.stringify(after.data, null, '\t')}\n`);
			});
			resolve();
		});
	}

	/**
	 * Replaces the motion's shipped sprites, face and head parts with the staged ones and puts the motion into
	 * `manifest.json`, keeping every other figure and motion; the result must pass the schema and name only files
	 * that are there.
	 */
	putMotion(figure: FigureName, motion: Motion, asset: MotionAsset): Promise<void> {
		// Inside the executor every failure, also one reading the old manifest, becomes the promise's rejection.
		return new Promise((resolve) => {
			const path = join(this.config.root, 'manifest.json');
			const before: FigureManifest = existsSync(path) ? this.read(path) : { version: 1, figures: {} };
			const entry = manifestEntry(asset);
			const kept = before.figures[figure];
			const motions = { ...(kept?.motions ?? {}), [motion]: entry };
			const after = figureManifestSchema.safeParse({
				...before,
				figures: { ...before.figures, [figure]: { ...(kept?.head ? { head: kept.head } : {}), motions } },
			});
			if (!after.success)
				throw new FigureException(FigureExceptionKey.StorageFailed, `manifest: ${after.error.message}`);
			const staged = motionFolders(figure, motion).filter((sub) => existsSync(join(this.config.staging, sub)));
			const heads = (asset.parts ?? []).flatMap((p) => [p, ...(p.hide ? [p.hide] : [])]);
			const missing = [...asset.frames, ...asset.face, ...heads]
				.map((f) => f.file)
				.filter((file) => !existsSync(join(this.after(file, staged), file)));
			if (missing.length > 0)
				throw new FigureException(FigureExceptionKey.StorageFailed, `missing ${missing.join(', ')}`);
			this.ship(staged);
			onDisk('write the manifest', () => {
				writeFileSync(path, `${JSON.stringify(after.data, null, '\t')}\n`);
			});
			resolve();
		});
	}

	/**
	 * Reads and checks the manifest that is there.
	 * @throws {FigureException} the storage key when it is no manifest the protocol accepts.
	 */
	private read(path: string): FigureManifest {
		const parsed = figureManifestSchema.safeParse(
			onDisk('read the manifest', () => JSON.parse(readFileSync(path, 'utf8')) as unknown),
		);
		if (!parsed.success)
			throw new FigureException(FigureExceptionKey.StorageFailed, `manifest: ${parsed.error.message}`);
		return parsed.data;
	}

	/** The folder a file of the manifest lies in once the staged folders are shipped: staging or the asset folder. */
	private after(file: string, staged: readonly string[]): string {
		return staged.some((sub) => file.startsWith(`${sub}/`)) ? this.config.staging : this.config.root;
	}

	/** Moves the staged folders over their shipped ones; a folder nothing was staged for stays. */
	private ship(subs: readonly string[]): void {
		for (const sub of subs) {
			const staged = join(this.config.staging, sub);
			onDisk(`ship ${sub}`, () => {
				const shipped = join(this.config.root, sub);
				rmSync(shipped, { recursive: true, force: true });
				cpSync(staged, shipped, { recursive: true });
				rmSync(staged, { recursive: true, force: true });
			});
		}
	}

	/** An emptied staging folder for one figure's motion. */
	private fresh(sub: string): string {
		const folder = join(this.config.staging, sub);
		onDisk(`clear ${sub}`, () => {
			rmSync(folder, { recursive: true, force: true });
			mkdirSync(folder, { recursive: true });
		});
		return folder;
	}

	/** Runs the Python pixel step, then holds every file it staged in `folder` to the size limit. */
	private async step<T>(args: readonly string[], schema: AnswerSchema<T>, folder: string): Promise<T> {
		const answer = await pixelStep(
			this.config.python,
			this.config.script,
			args,
			schema,
			FigureExceptionKey.StorageFailed,
		);
		for (const file of this.files(folder)) {
			const size = onDisk(`measure staged ${file}`, () => statSync(file).size);
			if (size > fileLimitBytes)
				throw new FigureException(FigureExceptionKey.StorageFailed, `staged ${file} has ${String(size)} bytes`);
		}
		return answer;
	}

	/** Every file in a staged folder. */
	private files(folder: string): string[] {
		return onDisk(`list ${folder}`, () =>
			readdirSync(folder, { recursive: true, withFileTypes: true })
				.filter((entry) => entry.isFile())
				.map((entry) => join(entry.parentPath, entry.name)),
		);
	}

	/** A staged file's path relative to the staging folder, which is its path in the asset folder once shipped. */
	private within(file: string): string {
		return relative(this.config.staging, file);
	}
}
