// cutFrames.service.ts — the use case "cut a clip into sprites": the measurer reports every frame, the core plans
// which become sprites, the cutter applies the plan.
import { ClipMode } from '../../domain/Figure/clipMode.enum.ts';
import type { CutFrames } from '../../domain/Figure/cutFrames.interface.ts';
import type { IFrameCutter } from '../../port/outgoing/frameCutter.interface.ts';
import type { IFrameMeasurer } from '../../port/outgoing/frameMeasurer.interface.ts';
import type { CutFramesCommand } from './cutFramesCommand.ts';
import { PlanFramesService } from './planFrames.service.ts';

/**
 * Cuts one clip into sprites.
 * @throws {FigureException} the missing frame key when a range reaches beyond the clip; the measurer's and the
 * cutter's own keys when they fail.
 */
export class CutFramesService {
	constructor(
		private readonly measurer: IFrameMeasurer,
		private readonly cutter: IFrameCutter,
		private readonly planner: PlanFramesService = new PlanFramesService(),
	) {}

	/** Measures the clip, plans its sprites by the command's mode, and has the cutter write them. */
	async cut(command: CutFramesCommand): Promise<CutFrames> {
		const measures = await this.measurer.measure(command.clip, command.values);
		const plan =
			command.mode === ClipMode.Cycle
				? this.planner.planCycle(measures, command.values, command.range)
				: this.planner.planLoop(
						measures,
						command.range ?? { first: 0, last: measures.length - 1 },
						command.step ?? 1,
						command.forward ?? true,
						command.values,
					);
		return { plan, result: await this.cutter.cut(command.clip, plan, command.values) };
	}
}
