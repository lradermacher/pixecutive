// fixtureManifest.ts — a small manifest for the playground's specs: figure m with an idle of three frames and a walk
// of two, each face part 10 by 8 pixels at y 60 from the head origin.
import type { FigureManifest } from '@pixecutive/protocol';

/** Shared by every spec; a spec that changes a manifest changes a copy. */
export const fixtureManifest: FigureManifest = Object.freeze({
	version: 1,
	figures: {
		m: {
			motions: {
				idle: {
					frames: [
						{ file: 'm/body/idle/00.png', hold: 1 },
						{ file: 'm/body/idle/01.png', hold: 1 },
						{ file: 'm/body/idle/02.png', hold: 1 },
					],
					width: 89,
					height: 201,
					advance: 0,
					head: {
						scale: 0.345,
						origin: [
							[-48, -36],
							[-48, -35],
							[-47, -36],
						],
					},
					face: {
						mouth: { file: 'm/face/idle/mouth.png', x: 97, y: 60, width: 10, height: 8 },
						blank: { file: 'm/face/idle/blank.png', x: 82, y: 60, width: 10, height: 8 },
						eyes: { file: 'm/face/idle/eyes.png', x: 88, y: 60, width: 10, height: 8 },
						'eyes-closed': { file: 'm/face/idle/eyes-closed.png', x: 87, y: 60, width: 10, height: 8 },
					},
				},
				walk: {
					frames: [
						{ file: 'm/body/walk/00.png', hold: 2 },
						{ file: 'm/body/walk/01.png', hold: 3 },
					],
					width: 94,
					height: 201,
					advance: 1.6,
					head: {
						scale: 0.345,
						origin: [
							[-40, -36],
							[-41, -37],
						],
					},
					face: {
						blank: { file: 'm/face/walk/blank.png', x: 82, y: 60, width: 10, height: 8 },
						eyes: { file: 'm/face/walk/eyes.png', x: 88, y: 60, width: 10, height: 8 },
					},
				},
			},
		},
	},
});
