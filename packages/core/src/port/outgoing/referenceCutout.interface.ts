// referenceCutout.interface.ts — cuts a key-colored turnaround into one transparent image per view.

/** Splits `image` into `panels` equal views side by side, keys out `keyColor` and answers the written paths. */
export interface IReferenceCutout {
	cut(image: string, panels: number, keyColor: string, outputDir: string): Promise<readonly string[]>;
}
