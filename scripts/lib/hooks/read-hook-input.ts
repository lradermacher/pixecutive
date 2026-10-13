// read-hook-input.ts — reads the JSON a Claude Code hook gets on stdin, once, the same way for every hook.

import { readFileSync } from 'node:fs';

/** The fields of the hook input that the hooks of this repo read; a field of the wrong type reads as empty. */
export interface HookInput {
	toolName: string;
	sessionId: string;
	prompt: string;
	filePath: string;
	command: string;
	issueKey: string;
	transitionId: string;
	subagentType: string;
	model: string;
	/** What a Write puts into the file. */
	content: string;
	/** The replacements of an Edit or MultiEdit, in the order the tool applies them. */
	edits: Array<{ oldString: string; newString: string; replaceAll: boolean }>;
}

function text(value: unknown): string {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * Parses stdin. Returns null when it is no JSON object: a call that does not concern the hook. `null`, `true` or an
 * object where a string belongs reads as empty, never as the text "null", so an empty check catches it.
 */
export function readHookInput(): HookInput | null {
	let data: unknown;
	try {
		data = JSON.parse(readFileSync(0, 'utf8'));
	} catch {
		return null;
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
	const record = data as Record<string, unknown>;
	const tool = (
		typeof record['tool_input'] === 'object' && record['tool_input'] !== null ? record['tool_input'] : {}
	) as Record<string, unknown>;
	const transition = (
		typeof tool['transition'] === 'object' && tool['transition'] !== null ? tool['transition'] : {}
	) as Record<string, unknown>;
	return {
		toolName: text(record['tool_name']),
		sessionId: text(record['session_id']),
		prompt: text(record['prompt']),
		filePath: text(tool['file_path']) || text(tool['notebook_path']) || text(tool['path']),
		command: text(tool['command']),
		issueKey: text(tool['issueIdOrKey']),
		transitionId: text(transition['id']),
		subagentType: text(tool['subagent_type']),
		model: text(tool['model']),
		content: text(tool['content']),
		edits: (Array.isArray(tool['edits']) ? (tool['edits'] as unknown[]) : [tool])
			.filter(
				(edit): edit is Record<string, unknown> => typeof edit === 'object' && edit !== null && 'new_string' in edit,
			)
			.map((edit) => ({
				oldString: text(edit['old_string']),
				newString: text(edit['new_string']),
				replaceAll: edit['replace_all'] === true,
			})),
	};
}
