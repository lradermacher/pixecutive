// paintHands.service.ts — the use case "paint the finger states into a motion's sprites": the core decides which
// state each sprite shows, the painter applies it, so fingers move although the video model melts moving fingers.
import type { IHandPainter } from '../../port/outgoing/handPainter.interface.ts';
import type { PaintHandsCommand } from './paintHandsCommand.ts';

/**
 * Paints drawn finger states into sprites.
 * @throws {FigureException} the painter's own key when it fails.
 */
export class PaintHandsService {
	constructor(private readonly painter: IHandPainter) {}

	/**
	 * The state per sprite: blocks of `ticks` sprites alternate between the sprite's own hands (null) and the states
	 * in turn, so every state is framed by the relaxed hands: own, first, own, second, own, first, ...
	 */
	sequence(frames: number, states: number, ticks: number): (number | null)[] {
		return Array.from({ length: frames }, (_, k) => {
			const block = Math.floor(k / ticks);
			return block % 2 === 0 ? null : ((block - 1) / 2) % states;
		});
	}

	/** Decides the state per sprite and has the painter paint them; answers that sequence. */
	async paint(command: PaintHandsCommand): Promise<(number | null)[]> {
		const { hands } = command;
		const sequence = this.sequence(command.frames.length, hands.states.length, hands.ticks);
		await this.painter.paint({
			frames: command.frames,
			still: command.still,
			scale: command.scale,
			box: hands.box,
			states: hands.states,
			sequence,
		});
		return sequence;
	}
}
