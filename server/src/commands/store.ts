import { Redis } from 'ioredis';
import { Commit, toCommits } from '.';

export const CommitStore = {
	put: (client: Redis, channel: string, commit: Commit): Promise<number> => {
		return new Promise<number>(async (resolve, reject) => {
			const commitStr = JSON.stringify(commit);
			const timestamp = Date.now();
			const count = await client.zadd(channel, timestamp, commitStr); // commit ID is random, will not duplicate
			if (count === 1) {
				const idx = await client.zrank(channel, commitStr);
				if (idx !== null) {
					await client.hset(`${channel}CommitIdx`, commit.id, idx);
					client.publish(channel, JSON.stringify({ id: commit.id, timestamp })); // Notify a new commit is written
					resolve(timestamp);
				} else
					reject(new Error('[CommitStore.write] commit sorted set corrupted')); // Should not happen, as the data was just written to REDIS two lines ago (zadd)
			} else if (count === 0) {
				reject(new Error(`[CommitStore.write] commit ${commitStr} already exists`));
			} else
				reject(new Error(`[CommitStore.write] unknown error ${count} writing commit`));
		});
	},
	get: (client: Redis, channel: string, args: {
		id?: string;
		fromTime?: number;
		toTime?: number;
	}): Promise<Commit[]> => {
		return new Promise<Commit[]>(async (resolve, reject) => {
			if (args.id) {
				const idx = await client.hget(`${channel}CommitIdx`, args.id);
				if (idx) {
					const index = parseInt(idx, 10);
					try {
						resolve(toCommits('[CommitStore.get]', await client.zrange(channel, index, index, 'WITHSCORES')));
					} catch (error) {
						reject(error);
					}
				} else {
					reject(new Error(`[CommitStore.get] Commit ID ${args.id} not found in index`));
				}
			} else {
				try {
					resolve(toCommits('[CommitStore.get]',
						await client.zrangebyscore(channel,
							args.fromTime ? args.fromTime : '-inf',
							args.toTime ? args.toTime : '+inf',
							'WITHSCORES')
					));
				} catch (error) {
					reject(error);
				}
			}
		});
	},
}
