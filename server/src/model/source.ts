import { DataSource } from 'apollo-datasource';
import { Redis } from 'ioredis';
import { Commit, isCommit } from '.';

export const DEFAULT_TOPIC = 'commonRoom';

export class EventDs extends DataSource {
	constructor(private client: Redis) {
		super();
	}

	write(commit: Commit): Promise<number> {
		return new Promise<number>(async (resolve, reject) => {
			if (!isCommit(commit)) {
				reject(new Error('[EventDs.write] Invalid commit format'));
			} else {
				const token = commit.events[0].payload.gameToken ? commit.events[0].payload.gameToken : DEFAULT_TOPIC;
				const count = await this.client.zadd(token, commit.timestamp, JSON.stringify(commit));
				if (count === 1) {
					this.client.publish(token, JSON.stringify({ id: commit.id, timestamp: commit.timestamp })); // Notify a new commit is written
					resolve(1);
				} else
					reject(count);
			}
		});
	}
}
