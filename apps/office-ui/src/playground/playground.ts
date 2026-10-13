// playground.ts — the playground's state: which motion, facing, zoom and playback are chosen, the clock of 24 ticks
// per second, and the tiles that follow from them. Drawing is the page's.
import type { FigureManifest } from '@pixecutive/protocol';
import { Facing } from './facing.enum.ts';
import { frameAt } from './frameAt.ts';
import type { ManifestMotion } from './manifestMotion.interface.ts';
import { Playback } from './playback.enum.ts';

/** One figure in one motion as the stage shows it now. */
export interface Tile {
	readonly figure: string;
	readonly name: string;
	readonly motion: ManifestMotion;
	readonly frame: number;
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
				return [{ figure, name, motion, frame, label }];
			}),
		);
	}

	/** Moves the clock on by `ms` of real time, unless paused. */
	advance(ms: number): void {
		if (this.paused) return;
		this.elapsedMs += ms;
		this.tick = Math.floor(this.elapsedMs / tickMs);
	}

	/** Pauses and moves the clock to the next tick at which a shown tile changes its frame. */
	step(): void {
		this.paused = true;
		const shown = this.tiles();
		const longest = Math.max(1, ...shown.map((tile) => tile.motion.frames.reduce((sum, f) => sum + f.hold, 0) * 2));
		let next = this.tick + 1;
		while (next < this.tick + longest && shown.every((tile) => this.frameOf(tile.motion, next) === tile.frame))
			next += 1;
		this.tick = next;
		this.elapsedMs = next * tickMs;
	}

	/** A motion on the spot follows the chosen playback; a walk, which moves on, always loops. */
	private frameOf(motion: ManifestMotion, tick: number): number {
		const holds = motion.frames.map((f) => f.hold);
		return frameAt(holds, tick, motion.advance === 0 ? this.playback : Playback.Loop);
	}
}
