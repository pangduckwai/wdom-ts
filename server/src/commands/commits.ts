import { Redis } from 'ioredis';
import { BaseEvent, deserialize, generateToken } from '..';
import { BusyTimeout } from '.';

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

export const toCommits = (tag: string, values: string[][]) => {
	const results: Commit[] = [];
	for (const value of values) {
		const commit = deserialize(tag, value[1], isCommit);
		commit.id = value[0];
		results.push(commit);
	}
	return results;
};

export const createCommit = () => {
	const commit: Commit = {
		id: '',
		version: 0,
		events: []
	};

	const build = (): Commit => {
		if (commit.events.length < 1)  throw new Error('[createCommit] Invalid parameter(s)');
		return commit;
	}

	const addEvent = <E extends BaseEvent>(event: E) => {
		commit.events.push(event);
		return {
			build,
			addEvent
		};
	}

	return { addEvent };
};

/* NOTE HERE !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
The following can calc number of digits needed,
but useless in this case, because there is no way
to determine the max value with clashed score, as
this script is called individually
	local count = 0
	local value = ARGV[2]
	repeat
		value = value / 10
		count = count + 1
	until value < 1
	return string.format('%0' .. count .. 'd', ARGV[1])
*/
// KEYS[1] - Publish channel
// KEYS[2] - Commit
// KEYS[3] - Is Busy
// ARGV[1] - Serialized commit object
// ARGV[2] - Timestamp offset
const put = `
local isbusy = redis.call("get", KEYS[3])
if isbusy then
	return nil
else
	redis.call("set", KEYS[3], "true", "px", ${BusyTimeout})

	local sid = redis.call("xadd", KEYS[2], "*", "commit", ARGV[1])
	if sid then
		redis.call("publish", KEYS[1], sid)

		local cnt = 0
		local expire = redis.call("xrange", KEYS[2], "-", ARGV[2])
		for i = 1, #expire do
			cnt = cnt + redis.call("xdel", KEYS[2], expire[i][1])
		end

		return sid
	else
		return redis.error_reply("[CommitStore] error writing commit")
	end
end`;

export const CommitStore = (client: Redis, ttl?: number) => {
	const _ttl = ttl ? ttl : 86400000; // 1 day == 24x60x60x1000 milliseconds
	return {
		put: (channel: string, commit: Commit): Promise<Commit> => {
			return new Promise<Commit>(async (resolve, reject) => {
				const timestamp = Date.now();
				const offset = '' + (timestamp - _ttl);
				try {
					const result = await client.eval(put, 3, [
						channel,
						`${channel}:Commit`,
						`${channel}:Busy`,
						JSON.stringify(commit), offset
					]);
					if (result) {
						commit.id = result;
						commit.timestamp = timestamp;
						resolve(commit);
					} else {
						reject(null); // busy
					}
				} catch (error) {
					reject(error); // redis.error_reply
				}
			});
		},
		get: (channel: string, args?: {
			id?: string;
			from?: string;
			to?: string;
		}): Promise<Commit[]> => {
			return new Promise<Commit[]>(async (resolve, reject) => {
				const { id, from, to } = args ? args : { id: undefined, from: undefined, to: undefined };
				const key1 = `${channel}:Commit`;

				const results = (id) ?
					await client.xrange(key1, id, id) :
					await client.xrange(key1, from ? from : '-', to ? to : '+');
				if (results.length > 0) {
					try {
						resolve(toCommits('[CommitStore]', results.map(result => [result[0][0], result[0][1][1]])));
					} catch (error) {
						reject(error);
					}
				} else {
					reject(new Error(`[CommitStore] No commit found when search criteria ${args}`));
				}
			});
		}
	};
};
