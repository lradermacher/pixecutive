// runFigureCommand.ts — the figures' part of the composition root: wires the video model, the frame, head and part
// adapters, the image editor, the asset store and the work between the commands to the core's use cases.
import type { EventEmitter } from 'node:events';
import {
	CutFramesService,
	ExportMotionService,
	type IImageEditor,
	MakeHeadPartService,
	PaintHandsService,
	type IRenderMachine,
	RenderClipService,
	TrackHeadService,
} from '@pixecutive/core';
import {
	AssetStoreFilesAdapter,
	FrameCutterOpencvAdapter,
	FrameMeasurerOpencvAdapter,
	HandPainterOpencvAdapter,
	HeadTrackerOpencvAdapter,
	ImageEditorCodexAdapter,
	MotionWorkFilesAdapter,
	PartCutterOpencvAdapter,
	VideoRendererLtxAdapter,
} from '@pixecutive/infrastructure';
import { buildGridHandler } from './cli/buildGrid.handler.ts';
import { cutFramesHandler } from './cli/cutFrames.handler.ts';
import { cutPartHandler } from './cli/cutPart.handler.ts';
import { drawPartHandler } from './cli/drawPart.handler.ts';
import { exportMotionHandler } from './cli/exportMotion.handler.ts';
import { fitPartHandler } from './cli/fitPart.handler.ts';
import { PipelineCommand } from './cli/pipelineCommand.enum.ts';
import { prepareHairUnderHatHandler } from './cli/prepareHairUnderHat.handler.ts';
import { renderClipHandler } from './cli/renderClip.handler.ts';
import { splitGridHandler } from './cli/splitGrid.handler.ts';
import { trackHeadHandler } from './cli/trackHead.handler.ts';
import { figureConfig } from './figureConfig.ts';

/** The motion chain's and the head parts' commands. */
export type FigureCommand = Exclude<PipelineCommand, PipelineCommand.Render | PipelineCommand.Status>;

/** How the guard reads the memory and how often, where interrupts arrive, and where a clip's steps are shown. */
export interface GuardSetup {
	readonly readMemory: () => { readonly pressure: number; readonly swapMb: number };
	readonly intervalMs: number;
	readonly interrupts: EventEmitter;
	readonly progress: (step: string) => void;
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
	// The Codex CLI is looked up when a drawing is made, so the other head commands run where it is missing.
	const editor: IImageEditor = { edit: (job) => new ImageEditorCodexAdapter(setup.codex()).edit(job) };
	const head = new MakeHeadPartService(
		editor,
		new PartCutterOpencvAdapter({ python: setup.python, script: setup.scripts.parts }),
	);
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
				new PaintHandsService(new HandPainterOpencvAdapter(frames)),
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
				head,
			);
		case PipelineCommand.Grid:
			return buildGridHandler(args, setup, head);
		case PipelineCommand.Draw:
			return drawPartHandler(args, setup, head);
		case PipelineCommand.Split:
			return splitGridHandler(args, setup, head);
		case PipelineCommand.Cut:
			return cutPartHandler(args, setup, head);
		case PipelineCommand.HairUnderHat:
			return prepareHairUnderHatHandler(args, setup, head);
		case PipelineCommand.Fit:
			return fitPartHandler(args, setup, head);
	}
}
