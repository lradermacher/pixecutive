// pipelineCommand.enum.ts — the commands the asset pipeline's command line knows.

/** The first argument of `pnpm assets`. */
export enum PipelineCommand {
	Render = 'render',
	Status = 'status',
	Clip = 'clip',
	Frames = 'frames',
	Track = 'track',
	Export = 'export',
	Grid = 'grid',
	Draw = 'draw',
	Split = 'split',
	Cut = 'cut',
	HairUnderHat = 'hair-under-hat',
	Fit = 'fit',
}
