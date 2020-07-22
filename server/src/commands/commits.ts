import { Redis } from 'ioredis';
import { BaseEvent } from '.';

export interface Commit {
	id: string;
	version: number;
	events: BaseEvent[];
	timestamp?: number;
};

export const isCommit = (variable: any): variable is Commit => {
	const val = variable as Commit;
	return (val.id !== undefined) &&
		(val.version !== undefined) &&
		(val.events && (val.events.length > 0));
};

export const toCommit = (tag: string, str: string) => {
	const result = JSON.parse(str);
	if (isCommit(result))
		return result as Commit;
	else
		throw new Error(`${tag} Unknown object type ${str}`);
};

export const toCommits = (tag: string, values: string[]) => {
	if ((values.length % 2) !== 0) {
		throw new Error(`${tag} Invalid format in incoming data`);
	}

	const results: Commit[] = [];
	for (let idx = 0; idx < values.length; idx += 2) {
		const score = parseInt(values[idx + 1], 10);
		if (score === NaN) {
			throw new Error(`${tag} Invalid format in scores ${idx} - ${values[idx + 1]}`);
		}

		const commit = toCommit(tag, values[idx]);
		commit.timestamp = score;
		results.push(commit);
	}
	return results;
};

const put = `
local count = redis.call("zadd", KEYS[2], ARGV[1], ARGV[2])
if count == 1 then
  local idx = redis.call("zrank", KEYS[2], ARGV[2])
  if idx then
    if redis.call("hset", KEYS[3], ARGV[3], idx) >= 0 then
			redis.call("publish", KEYS[1], \'{ \"id\": \"\' .. ARGV[3] .. \'\", \"timestamp\": \' .. ARGV[1] .. \' }\')
			return "OK"
		else
			return redis.error_reply("[CommitStore] error writing commit index")
		end
  else
    return redis.error_reply("[CommitStore] commit index sorted-set corrupted")
  end
else
  if count == 0 then
    return redis.error_reply("[CommitStore] commit " .. ARGV[2] .. " already exists")
  else
    return redis.error_reply("[CommitStore] unknown error when writing commit (".. count .. ")")
  end
end`;

export const CommitStore = (client: Redis) => {
	return {
		put: (channel: string, commit: Commit): Promise<Commit> => {
			return new Promise<Commit>(async (resolve, reject) => {
				const timestamp = Date.now();
				try {
					const result = await client.eval(put, 3, [
						channel,
						`${channel}:Commit`,
						`${channel}:Commit:Idx`,
						timestamp,
						JSON.stringify(commit), commit.id
					]);
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
		get: (channel: string, args?: {
			id?: string;
			fromTime?: number;
			toTime?: number;
		}): Promise<Commit[]> => {
			return new Promise<Commit[]>(async (resolve, reject) => {
				const { id, fromTime, toTime } = args ? args : { id: undefined, fromTime: undefined, toTime: undefined };
				if (id) {
					const idx = await client.hget(`${channel}:Commit:Idx`, id);
					if (idx) {
						const index = parseInt(idx, 10);
						try {
							resolve(toCommits('[CommitStore]', await client.zrange(`${channel}:Commit`, index, index, 'WITHSCORES')));
						} catch (error) {
							reject(error);
						}
					} else {
						reject(new Error(`[CommitStore] Commit ID ${id} not found in index`));
					}
				} else {
					try {
						resolve(toCommits('[CommitStore]',
							await client.zrangebyscore(`${channel}:Commit`,
								fromTime ? fromTime : '-inf',
								toTime ? toTime : '+inf',
								'WITHSCORES')
						));
					} catch (error) {
						reject(error);
					}
				}
			});
		}
	};
};
