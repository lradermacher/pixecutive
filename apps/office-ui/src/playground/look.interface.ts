// look.interface.ts — the head parts a figure wears: per kind the variant chosen, none where a kind is not set.
import type { HeadPartKind } from '@pixecutive/protocol';

/** The chosen variant per head part kind. */
export type Look = Readonly<Partial<Record<HeadPartKind, number>>>;
