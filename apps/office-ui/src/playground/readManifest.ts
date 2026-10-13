// readManifest.ts — checks what `manifest.json` holds against the protocol's schema; a refused manifest answers why,
// so the page shows the reason instead of a stage.
import { type FigureManifest, figureManifestSchema } from '@pixecutive/protocol';

/** The manifest, or the reason it was refused. */
export type ManifestReading = { readonly manifest: FigureManifest } | { readonly reason: string };

/** Parses `json` by the schema; the reason names every refused field with its path. */
export function readManifest(json: unknown): ManifestReading {
	const parsed = figureManifestSchema.safeParse(json);
	if (parsed.success) return { manifest: parsed.data };
	return {
		reason: parsed.error.issues
			.map((issue) => `${issue.path.map(String).join('.') || 'manifest'}: ${issue.message}`)
			.join('; '),
	};
}
