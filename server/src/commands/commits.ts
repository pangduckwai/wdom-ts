import { Redis } from 'ioredis';
import { deserialize } from '..';
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

export const toCommits = (tag: string, values: string[]) => {
	if ((values.length % 2) !== 0) {
		throw new Error(`${tag} Invalid format in incoming data`);
	}

	const results: {index: number; commit: Commit}[] = [];
	for (let i = 0; i < values.length; i += 2) {
		const index = parseInt(values[i], 10);
		if (index === NaN) {
			throw new Error(`${tag} Invalid format in index ${i} - ${values[i]}`);
		}

		const commit = deserialize(tag, values[i+1], isCommit);
		results.push({index, commit});
	}
	return results;
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
// KEYS[3] - Commit index (id vs index)
// KEYS[4] - Commit index (timestamp vs index)
// ARGV[1] - Serialized commit object
// ARGV[2] - Commit id
// ARGV[3] - Timestamp
const put = `
local count = redis.call("rpush", KEYS[2], ARGV[1])
if count > 0 then
	local idx = count - 1
	local r1 = redis.call("hset", KEYS[3], ARGV[2], idx)
	local r2 = redis.call("zadd", KEYS[4], ARGV[3], string.format("%04d", idx))
	if r1 >= 0 and r2 == 1 then
		redis.call("publish", KEYS[1], ARGV[1])
		return idx
	else
		return redis.error_reply("[CommitStore] error writing commit index (" .. r1 .. ", " .. r2 .. ")")
	end
else
	return redis.error_reply("[CommitStore] unknown error when writing commit (".. count .. ")")
end`;

// NOTE: Same as 'put' except:
// ARGV[4] - Notification
const pub = `
local count = redis.call("rpush", KEYS[2], ARGV[1])
if count > 0 then
	local idx = count - 1
	local r1 = redis.call("hset", KEYS[3], ARGV[2], idx)
	local r2 = redis.call("zadd", KEYS[4], ARGV[3], string.format("%04d", idx))
	if r1 >= 0 and r2 == 1 then
		redis.call("publish", KEYS[1], ARGV[4])
		return idx
	else
		return redis.error_reply("[CommitStore] error writing commit index (" .. r1 .. ", " .. r2 .. ")")
	end
else
	return redis.error_reply("[CommitStore] unknown error when writing commit (".. count .. ")")
end`;

// KEYS[1] - Commit
// KEYS[2] - Commit index (id vs index)
// ARGV[1] - Commit id
const get1 = `
local result = {}
local idx = redis.call("hget", KEYS[2], ARGV[1])
if idx then
	local item = redis.call("lindex", KEYS[1], idx)
	if item then
		table.insert(result, idx)
		table.insert(result, item)
		return result
	else
		return nil
	end
else
	return nil
end`;

// KEYS[1] - Commit
// KEYS[2] - Commit index (timestamp vs index)
// ARGV[1] - from time
// ARGV[2] - to time
const get2 = `
local result = {}
local indexes = redis.call("zrangebyscore", KEYS[2], ARGV[1], ARGV[2])
for i = 1, #indexes do
	local cmt = redis.call("lindex", KEYS[1], tonumber(indexes[i]))
	if cmt then
		table.insert(result, indexes[i])
		table.insert(result, cmt)
	end
end
return result
`;

export const CommitStore = (client: Redis) => {
	return {
		put: (channel: string, commit: Commit): Promise<Commit> => {
			return new Promise<Commit>(async (resolve, reject) => {
				const timestamp = Date.now();
				try {
					commit.timestamp = timestamp;
					const result = await client.eval(put, 4, [
						channel,
						`${channel}:Commit`,
						`${channel}:Commit:Idx`,
						`${channel}:Commit:Time`,
						JSON.stringify(commit), commit.id, timestamp
					]);
					if (result >= 0) {
						resolve(commit);
					} else {
						reject(new Error(result));
					}
				} catch (error) {
					reject(error);
				}
			});
		},
		pub: (channel: string, commit: Commit): Promise<Commit> => {
			return new Promise<Commit>(async (resolve, reject) => {
				const timestamp = Date.now();
				try {
					commit.timestamp = timestamp;
					const result = await client.eval(pub, 4, [
						channel,
						`${channel}:Commit`,
						`${channel}:Commit:Idx`,
						`${channel}:Commit:Time`,
						JSON.stringify(commit), commit.id, timestamp,
						`{"id":"${commit.id}","timestamp":${timestamp}}`
					]);
					if (result >= 0) {
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
		}): Promise<{
			index: number;
			commit: Commit;
		}[]> => {
			return new Promise<{
				index: number;
				commit: Commit;
			}[]>(async (resolve, reject) => {
				const { id, fromTime, toTime } = args ? args : { id: undefined, fromTime: undefined, toTime: undefined };
				const key1 = `${channel}:Commit`;
				const key2 = `${channel}:Commit:Idx`;
				const key3 = `${channel}:Commit:Time`;

				const result = (id) ?
					await client.eval(get1, 2, [key1, key2, id]) :
					await client.eval(get2, 2, [key1, key3, fromTime ? fromTime : '-inf', toTime ? toTime : '+inf'
					]);
				if (result) {
					try {
						resolve(toCommits('[CommitStore]', result));
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
