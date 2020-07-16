import { Redis } from 'ioredis';
import { Commit, toCommits } from '.';

const lua =
	'local count = redis.call("zadd", KEYS[1], ARGV[1], ARGV[2])\n' +
	'if count == 1 then\n' +
	'  local idx = redis.call("zrank", KEYS[1], ARGV[2])\n' +
	'  if idx then\n' +
	'    redis.call("hset", KEYS[2], ARGV[3], idx)\n' +
	'    redis.call("publish", KEYS[1], \'{ \"id\": \"\' .. ARGV[3] .. \'\", \"timestamp\": \' .. ARGV[1] .. \' }\')\n' +
	'    return "OK"\n' +
	'  else\n' +
	'    return redis.error_reply("[CommitStore lua] commit sorted set corrupted")\n' +
	'  end\n' +
	'else\n' +
	'  if count == 0 then\n' +
	'    return redis.error_reply("[CommitStore lua] commit " .. ARGV[2] .. " already exists")\n' +
	'  else\n' +
	'    return redis.error_reply("[CommitStore lua] unknown error when writing commit (".. count .. ")")\n' +
	'  end\n' +
	'end'

export const CommitStore = {
	put: (client: Redis, channel: string, commit: Commit): Promise<Commit> => {
		return new Promise<Commit>(async (resolve, reject) => {
			const timestamp = Date.now();
			try {
				const result = await client.eval(lua, 2, [channel, `${channel}CommitIdx`, timestamp, JSON.stringify(commit), commit.id]);
				if (result === 'OK') {
					commit.timestamp = timestamp;
					resolve(commit);
				} else {
					reject(new Error(result));
				}
			} catch (error) {
				reject(error);
			}
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
