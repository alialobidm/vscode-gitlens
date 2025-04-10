import type { GitFileChange } from './fileChange';
import type { GitRevisionRangeNotation } from './revision';

export interface GitDiff {
	readonly contents: string;
	readonly from: string;
	readonly to: string;
	readonly notation: GitRevisionRangeNotation | undefined;
}

export interface GitDiffHunkLine {
	current: string | undefined;
	previous: string | undefined;
	state: 'added' | 'changed' | 'removed' | 'unchanged';
}

export interface GitDiffHunk {
	readonly contents: string;
	readonly current: {
		readonly count: number;
		readonly position: { readonly start: number; readonly end: number };
	};
	readonly previous: {
		readonly count: number;
		readonly position: { readonly start: number; readonly end: number };
	};
	readonly lines: Map<number, GitDiffHunkLine>;
}

export interface GitDiffFile {
	readonly hunks: GitDiffHunk[];
	readonly contents?: string;
}

export interface GitDiffLine {
	readonly hunk: GitDiffHunk;
	readonly line: GitDiffHunkLine;
}

export interface GitDiffShortStat {
	readonly files: number;
	readonly additions: number;
	readonly deletions: number;
}

export interface GitDiffFiles {
	readonly files: GitFileChange[];
}

export interface GitDiffFileStats {
	readonly added: number;
	readonly deleted: number;
	readonly changed: number;
}

export type GitDiffFilter = 'A' | 'C' | 'D' | 'M' | 'R' | 'T' | 'U' | 'X' | 'B' | '*';
