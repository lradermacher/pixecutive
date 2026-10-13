// controlGroups.ts — the playground's controls as data: per group its title and options, each saying whether it is
// chosen and what choosing it does to the playground. The page only renders them.
import { HeadPartKind } from '@pixecutive/protocol';
import { Facing } from './facing.enum.ts';
import { Playback } from './playback.enum.ts';
import { Playground } from './playground.ts';

/** One button: its text, whether it is chosen now, and what a click does. */
export interface ControlOption {
	readonly text: string;
	readonly chosen: () => boolean;
	readonly choose: () => void;
}

/** A titled row of options. */
export interface ControlGroup {
	readonly title: string;
	readonly options: readonly ControlOption[];
}

/** The kinds a look picks from; hair under a hat is chosen with the hair. */
const wearable: readonly HeadPartKind[] = Object.values(HeadPartKind).filter(
	(kind) => kind !== HeadPartKind.HairUnderHat,
);

/** Per figure and kind a row: none, then every variant the figure has; a figure without the kind gets no row. */
function lookGroups(playground: Playground): ControlGroup[] {
	return Object.keys(playground.manifest.figures).flatMap((figure) =>
		wearable.flatMap((kind) => {
			const ids = playground.variants(figure, kind);
			if (ids.length === 0) return [];
			return [
				{
					title: `${figure.toUpperCase()} ${kind}`,
					options: [null, ...ids].map((id) => ({
						text: id === null ? 'none' : String(id),
						chosen: (): boolean => playground.looks[figure]?.[kind] === (id ?? undefined),
						choose: (): void => {
							playground.wear(figure, kind, id);
						},
					})),
				},
			];
		}),
	);
}

/** Motion (all, then each motion of the manifest), facing, mouth, playback on the spot, zoom, clock, then the looks. */
export function controlGroups(playground: Playground): ControlGroup[] {
	const motion = (name: string | null): ControlOption => ({
		text: name ?? 'all',
		chosen: (): boolean => playground.motion === name,
		choose: (): void => {
			playground.motion = name;
		},
	});
	return [
		{ title: 'Motion', options: [null, ...playground.motions()].map(motion) },
		{
			title: 'Facing',
			options: Object.values(Facing).map((facing) => ({
				text: facing === Facing.FrontRight ? 'front-right (mirrored)' : facing,
				chosen: (): boolean => playground.facing === facing,
				choose: (): void => {
					playground.facing = facing;
				},
			})),
		},
		{
			title: 'Mouth',
			options: [false, true].map((speaking) => ({
				text: speaking ? 'speaking' : 'closed',
				chosen: (): boolean => playground.speaking === speaking,
				choose: (): void => {
					playground.speaking = speaking;
				},
			})),
		},
		{
			title: 'On the spot',
			options: Object.values(Playback).map((playback) => ({
				text: playback === Playback.BackAndForth ? 'back and forth' : playback,
				chosen: (): boolean => playground.playback === playback,
				choose: (): void => {
					playground.playback = playback;
				},
			})),
		},
		{
			title: 'Zoom',
			options: Playground.zooms.map((zoom) => ({
				text: `${String(zoom)}×`,
				chosen: (): boolean => playground.zoom === zoom,
				choose: (): void => {
					playground.zoom = zoom;
				},
			})),
		},
		{
			title: 'Clock',
			options: [
				{
					text: 'play',
					chosen: (): boolean => !playground.paused,
					choose: (): void => {
						playground.paused = false;
					},
				},
				{
					text: 'step',
					chosen: (): boolean => playground.paused,
					choose: (): void => {
						playground.step();
					},
				},
			],
		},
		...lookGroups(playground),
	];
}
