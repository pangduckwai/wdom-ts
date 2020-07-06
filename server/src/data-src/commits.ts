import { Redis } from 'ioredis';
import { Commit, isCommit } from '../model';
import { CHANNEL, CHANNEL_IDX } from '.';

export const Commits = {
	put: (client: Redis, commit: Commit): Promise<number> => {
		return new Promise<number>(async (resolve, reject) => {
			if (!isCommit(commit)) {
				reject(new Error('[CommitsDS.write] Invalid commit format'));
			} else {
				commit.timestamp = Date.now();
				const commitStr = JSON.stringify(commit);
				const count = await client.zadd(CHANNEL, commit.timestamp, commitStr); // commit ID is random, will not duplicate
				if (count === 1) {
					const idx = await client.zrank(CHANNEL, commitStr);
					if (idx !== null) {
						await client.hset(CHANNEL_IDX, commit.id, idx);
						client.publish(CHANNEL, JSON.stringify({ id: commit.id, timestamp: commit.timestamp })); // Notify a new commit is written
						resolve(1);
					} else
						reject(new Error('[CommitsDS.write] commit sorted set corrupted'));
				} else
					reject(new Error(`[CommitsDS.write] unknown error ${count} writing commit`));
			}
		});
	},
	get: (client: Redis, args: {
		id?: string;
		fromTime?: number;
		toTime?: number;
	}): Promise<Commit[]> => {
		return new Promise<Commit[]>(async (resolve, reject) => {
			if (args.id) {
				const idx = await client.hget(CHANNEL_IDX, args.id);
				if (idx) {
					const index = parseInt(idx, 10);
					resolve((await client.zrange(CHANNEL, index, index)).map(result => {
						try {
							return JSON.parse(result);
						} catch (error) {
							return error;
						}
					}));
				} else {
					reject(new Error(`Commit ID ${args.id} not found in index`));
				}
			} else {
				resolve(
					(await client.zrangebyscore(CHANNEL,
						args.fromTime ? args.fromTime : '-inf',
						args.toTime ? args.toTime : '+inf')
					).map(result => {
						try {
							return JSON.parse(result);
						} catch (error) {
							return error;
						}
					})
				);
			}
		});
	},
}
