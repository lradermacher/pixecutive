// playground.ts — the playground's state: which motion, facing, zoom and playback are chosen, the clock of 24 ticks
// per second, and the tiles that follow from them. Drawing is the page's.
import { FacePart, type FigureManifest, HeadPartKind } from '@pixecutive/protocol';
import { Facing } from './facing.enum.ts';
import { frameAt } from './frameAt.ts';
import type { Look } from './look.interface.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';
import { Playback } from './playback.enum.ts';
import { speakingMouth } from './speakingMouth.ts';

/** One figure in one motion as the stage shows it now. */
export interface Tile {
	readonly figure: string;
	readonly name: string;
	readonly motion: ManifestMotion;
	readonly frame: number;
	readonly mouth: FacePart;
	readonly look: Look;
	readonly head?: FigureManifest['figures'][string]['head'];
	readonly label: string;
}

const tickMs = 1000 / 24;

/**
 * The playground's choices and clock. `motion` null shows every motion of every figure side by side.
 */
export class Playground {
	/** The zooms the page offers; whole numbers keep every sprite pixel a square of screen pixels. */
	static readonly zooms: readonly number[] = Object.freeze([1, 2, 4]);
	motion: string | null = null;
	facing: Facing = Facing.FrontLeft;
	zoom = 2;
	playback: Playback = Playback.BackAndForth;
	paused = false;
	/** Whether the figures speak: the mouth then follows the speaking rhythm on every motion. */
	speaking = false;
	/** Per figure the head parts it wears. */
	looks: Record<string, Look> = {};
	tick = 0;
	private elapsedMs = 0;

	constructor(readonly manifest: FigureManifest) {}

	/** Every motion name of the manifest, in first-seen order. */
	motions(): string[] {
		return [...new Set(Object.values(this.manifest.figures).flatMap((figure) => Object.keys(figure.motions)))];
	}

	/** The tiles of the chosen motion (or all motions), figure by figure within each motion. */
	tiles(): Tile[] {
		const names = this.motion === null ? this.motions() : [this.motion];
		return names.flatMap((name) =>
			Object.entries(this.manifest.figures).flatMap(([figure, { motions }]) => {
				const motion = motions[name];
				if (!motion) return [];
				const frame = this.frameOf(motion, this.tick);
				const hold = motion.frames[frame]?.hold ?? 1;
				const label = `${figure.toUpperCase()} · ${name} · ${this.facing} · frame ${String(frame)} / ${String(motion.frames.length)} · hold ${String(hold)}`;
				const look = this.looks[figure] ?? {};
				const head = this.manifest.figures[figure]?.head;
				return [
					{ figure, name, motion, frame, mouth: this.mouthAt(this.tick), look, ...(head ? { head } : {}), label },
				];
			}),
		);
	}

	/** The variants of `kind` a figure has, by their ids in the manifest's order. */
	variants(figure: string, kind: HeadPartKind): number[] {
		const motions = Object.values(this.manifest.figures[figure]?.motions ?? {});
		return Object.keys(motions[0]?.parts?.[kind] ?? {}).map(Number);
	}

	/** Puts variant `id` of `kind` on the figure, or takes the kind off with null. */
	wear(figure: string, kind: HeadPartKind, id: number | null): void {
		const worn = this.looks[figure] ?? {};
		const rest: Partial<Record<HeadPartKind, number>> = {};
		for (const other of Object.values(HeadPartKind)) {
			const value = worn[other];
			if (other !== kind && value !== undefined) rest[other] = value;
		}
		this.looks[figure] = id === null ? rest : { ...rest, [kind]: id };
	}

	/** Moves the clock on by `ms` of real time, unless paused. */
	advance(ms: number): void {
		if (this.paused) return;
		this.elapsedMs += ms;
		this.tick = Math.floor(this.elapsedMs / tickMs);
	}

	/** Pauses and moves the clock to the next tick at which a shown tile changes its frame or its mouth. */
	step(): void {
		this.paused = true;
		const shown = this.tiles();
		const longest = Math.max(1, ...shown.map((tile) => tile.motion.frames.reduce((sum, f) => sum + f.hold, 0) * 2));
		let next = this.tick + 1;
		const same = (tick: number): boolean =>
			this.mouthAt(tick) === this.mouthAt(this.tick) &&
			shown.every((tile) => this.frameOf(tile.motion, tick) === tile.frame);
		while (next < this.tick + longest && same(next)) next += 1;
		this.tick = next;
		this.elapsedMs = next * tickMs;
	}

	/** The mouth at `tick`: the speaking rhythm while speaking, else closed. */
	private mouthAt(tick: number): FacePart {
		return this.speaking ? speakingMouth(tick) : FacePart.Mouth;
	}

	/** A motion on the spot follows the chosen playback; a walk, which moves on, always loops. */
	private frameOf(motion: ManifestMotion, tick: number): number {
		const holds = motion.frames.map((f) => f.hold);
		return frameAt(holds, tick, motion.advance === 0 ? this.playback : Playback.Loop);
	}
}
