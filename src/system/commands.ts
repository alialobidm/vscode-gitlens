import type { GlCommands } from '../constants.commands';

export function createCommandLink<T>(command: GlCommands, args?: T): string {
	if (args == null) return `command:${command}`;

	return `command:${command}?${encodeURIComponent(typeof args === 'string' ? args : JSON.stringify(args))}`;
}

export function createMarkdownCommandLink<T>(command: GlCommands, args: T): string {
	if (args == null) return `command:${command}`;

	// Since we are using the command in a markdown link, we need to escape ()'s so they don't get interpreted as markdown
	return `command:${command}?${encodeURIComponent(typeof args === 'string' ? args : JSON.stringify(args)).replace(
		/([()])/g,
		'\\$1',
	)}`;
}
