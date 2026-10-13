// playback.enum.ts — how the playground plays a motion on the spot; the manifest names no playback.

/** Forward and around, or forward and back, which hides a jump where the ends of a loop on the spot do not meet. */
export enum Playback {
	Loop = 'loop',
	BackAndForth = 'back-and-forth',
}
