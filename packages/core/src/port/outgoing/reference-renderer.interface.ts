// reference-renderer.interface.ts — renders one reference image from a prompt under the memory guard.

/** Renders one reference image and answers with its path, or with why it did not finish. */
export interface IReferenceRenderer {
	render(
		input: string,
		prompt: string,
		seed: number,
	): Promise<{ readonly image: string | null; readonly problem: string }>;
}
