import type { Container } from '../../../../container';
import type { GitCache } from '../../../../git/cache';
import type { GitContributorsSubProvider } from '../../../../git/gitProvider';
import type { GitContributorsStats } from '../../../../git/models/contributor';
import { GitContributor } from '../../../../git/models/contributor';
import { getContributorsParser } from '../../../../git/parsers/logParser';
import { calculateContributionScore } from '../../../../git/utils/contributor.utils';
import { isUserMatch } from '../../../../git/utils/user.utils';
import { gate } from '../../../../system/decorators/-webview/gate';
import { log } from '../../../../system/decorators/log';
import { Logger } from '../../../../system/logger';
import { getLogScope } from '../../../../system/logger.scope';
import { normalizePath } from '../../../../system/path';
import type { Git } from '../git';
import type { LocalGitProvider } from '../localGitProvider';

export class ContributorsGitSubProvider implements GitContributorsSubProvider {
	constructor(
		private readonly container: Container,
		private readonly git: Git,
		private readonly cache: GitCache,
		private readonly provider: LocalGitProvider,
	) {}

	@gate()
	@log()
	async getContributors(
		repoPath: string,
		rev?: string | undefined,
		options?: { all?: boolean; merges?: boolean | 'first-parent'; stats?: boolean },
	): Promise<GitContributor[]> {
		if (repoPath == null) return [];

		let key = rev ?? '';
		if (options?.all) {
			key += ':all';
		}
		if (options?.merges) {
			key += `:merges:${options.merges}`;
		}
		if (options?.stats) {
			key += ':stats';
		}

		const contributorsCache = this.cache.contributors?.get(repoPath);

		let contributors = contributorsCache?.get(key);
		if (contributors == null) {
			async function load(this: ContributorsGitSubProvider) {
				try {
					repoPath = normalizePath(repoPath);
					const currentUser = await this.provider.config.getCurrentUser(repoPath);
					const parser = getContributorsParser(options?.stats);

					const args = [...parser.arguments, '--use-mailmap'];

					const merges = options?.merges ?? true;
					if (merges) {
						args.push(merges === 'first-parent' ? '--first-parent' : '--no-min-parents');
					} else {
						args.push('--no-merges');
					}

					if (options?.all) {
						args.push('--all', '--single-worktree');
					}

					const data = await this.git.log(repoPath, rev, undefined, ...args);

					const contributors = new Map<string, GitContributor>();
					const commits = parser.parse(data);
					for (const c of commits) {
						const key = `${c.author}|${c.email}`;
						const timestamp = Number(c.date) * 1000;

						let contributor: Mutable<GitContributor> | undefined = contributors.get(key);
						if (contributor == null) {
							contributor = new GitContributor(
								repoPath,
								c.author,
								c.email,
								isUserMatch(currentUser, c.author, c.email),
								1,
								new Date(timestamp),
								new Date(timestamp),
								c.stats
									? {
											...c.stats,
											contributionScore: calculateContributionScore(c.stats, timestamp),
									  }
									: undefined,
							);
							contributors.set(key, contributor);
						} else {
							contributor.commits++;
							const date = new Date(timestamp);
							if (date > contributor.latestCommitDate!) {
								contributor.latestCommitDate = date;
							}
							if (date < contributor.firstCommitDate!) {
								contributor.firstCommitDate = date;
							}
							if (options?.stats && c.stats != null) {
								if (contributor.stats == null) {
									contributor.stats = {
										...c.stats,
										contributionScore: calculateContributionScore(c.stats, timestamp),
									};
								} else {
									contributor.stats = {
										additions: contributor.stats.additions + c.stats.additions,
										deletions: contributor.stats.deletions + c.stats.deletions,
										files: contributor.stats.files + c.stats.files,
										contributionScore:
											contributor.stats.contributionScore +
											calculateContributionScore(c.stats, timestamp),
									};
								}
							}
						}
					}

					return [...contributors.values()];
				} catch (_ex) {
					contributorsCache?.delete(key);

					return [];
				}
			}

			contributors = load.call(this);

			if (contributorsCache == null) {
				this.cache.contributors?.set(repoPath, new Map([[key, contributors]]));
			} else {
				contributorsCache.set(key, contributors);
			}
		}

		return contributors;
	}

	@log()
	async getContributorsStats(
		repoPath: string,
		options?: { merges?: boolean; since?: string },
	): Promise<GitContributorsStats | undefined> {
		if (repoPath == null) return undefined;

		const scope = getLogScope();

		try {
			const data = await this.git.exec(
				{ cwd: repoPath },
				'shortlog',
				'-s',
				'--all',
				!options?.merges ? '--no-merges' : undefined,
				options?.since ? `--since=${options.since}` : undefined,
			);
			if (!data) return undefined;

			const contributions = data
				.split('\n')
				.map(line => parseInt(line.trim().split('\t', 1)[0], 10))
				.filter(c => !isNaN(c))
				.sort((a, b) => b - a);

			const result: GitContributorsStats = {
				count: contributions.length,
				contributions: contributions,
			};
			return result;
		} catch (ex) {
			Logger.error(ex, scope);
			debugger;

			return undefined;
		}
	}
}
