// clipMode.enum.ts — how a motion is taken from its clip (ADR 0022).

/** `Loop`: the same still anchors the first and the last frame. `Cycle`: a free clip, one stride cut out of it. */
export enum ClipMode {
	Loop = 'loop',
	Cycle = 'cycle',
}
