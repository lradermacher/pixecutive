// runFigureCommand.ts — the motion chain's part of the composition root: wires the video model, the frame and head
// adapters, the asset store and the work between the commands to the core's use cases, and runs one command.
import type { EventEmitter } from 'node:events';
import {
	CutFramesService,
	ExportMotionService,
	type IRenderMachine,
	RenderClipService,
	TrackHeadService,
} from '@pixecutive/core';
import {
	AssetStoreFilesAdapter,
	FrameCutterOpencvAdapter,
	FrameMeasurerOpencvAdapter,
	HeadTrackerOpencvAdapter,
	MotionWorkFilesAdapter,
	VideoRendererLtxAdapter,
} from '@pixecutive/infrastructure';
import { cutFramesHandler } from './cli/cutFrames.handler.ts';
import { exportMotionHandler } from './cli/exportMotion.handler.ts';
import { PipelineCommand } from './cli/pipelineCommand.enum.ts';
import { renderClipHandler } from './cli/renderClip.handler.ts';
import { trackHeadHandler } from './cli/trackHead.handler.ts';
import { figureConfig } from './figureConfig.ts';

/** The motion chain's commands. */
export type FigureCommand =
	PipelineCommand.Clip | PipelineCommand.Frames | PipelineCommand.Track | PipelineCommand.Export;

/** How the guard reads the memory and how often, and where interrupts arrive. */
export interface GuardSetup {
	readonly readMemory: () => { readonly pressure: number; readonly swapMb: number };
	readonly intervalMs: number;
	readonly interrupts: EventEmitter;
}

/**
 * Runs one motion chain command and answers its lines.
 * @throws {FigureException} with the key of the failure.
 */
export async function runFigureCommand(
	command: FigureCommand,
	args: readonly string[],
	env: Readonly<Record<string, string | undefined>>,
	machine: IRenderMachine,
	guard: GuardSetup,
): Promise<string[]> {
	const setup = figureConfig(env, machine);
	const work = new MotionWorkFilesAdapter(setup.work);
	const frames = { python: setup.python, script: setup.scripts.frames };
	switch (command) {
		case PipelineCommand.Clip:
			return renderClipHandler(
				args,
				setup,
				new RenderClipService(new VideoRendererLtxAdapter({ ...setup.clip(), ...guard })),
			);
		case PipelineCommand.Frames:
			return cutFramesHandler(
				args,
				setup,
				new CutFramesService(new FrameMeasurerOpencvAdapter(frames), new FrameCutterOpencvAdapter(frames)),
				work,
			);
		case PipelineCommand.Track:
			return trackHeadHandler(
				args,
				setup,
				new TrackHeadService(new HeadTrackerOpencvAdapter({ python: setup.python, script: setup.scripts.head })),
				work,
			);
		case PipelineCommand.Export:
			return exportMotionHandler(
				args,
				setup,
				new ExportMotionService(
					new AssetStoreFilesAdapter({
						python: setup.python,
						script: setup.scripts.assets,
						root: setup.assets,
						staging: setup.staging,
					}),
				),
				work,
			);
	}
}
