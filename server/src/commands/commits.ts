import { Redis } from 'ioredis';
import { Commit, toCommits } from '..';

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
// ARGV[1] - Commit id
// ARGV[2] - Serialized commit object
const put = `
local cnt = redis.call("rpush", KEYS[2], ARGV[2])
if cnt > 0 then
	local idx = cnt - 1
	local rtn = redis.call("hset", KEYS[3], ARGV[1], idx)
	if rtn == 1 then
		redis.call("publish", KEYS[1], '{"id":"' .. ARGV[1] .. '","index":' .. idx .. '}')
		return idx
	else
		return redis.error_reply("[CommitStore] error writing commit index (" .. rtn .. ")")
	end
else
	return redis.error_reply("[CommitStore] unknown error when writing commit (" .. cnt .. ")")
end`;

// KEYS[1] - Commit
// KEYS[2] - Commit index (id vs index)
// ARGV[1] - Commit id
const get = `
local result = {}
local idx = redis.call("hget", KEYS[2], ARGV[1])
if idx then
	local item = redis.call("lindex", KEYS[1], idx)
	if item then
		table.insert(result, item)
		return result
	else
		return nil
	end
else
	return nil
end`;

export const CommitStore = (client: Redis) => {
	return {
		put: (channel: string, commit: Commit): Promise<Commit> => {
			return new Promise<Commit>(async (resolve, reject) => {
				const timestamp = Date.now();
				try {
					commit.timestamp = timestamp;
					const result = await client.eval(put, 3, [
						channel,
						`${channel}:Commit`,
						`${channel}:Commit:Idx`,
						commit.id, JSON.stringify(commit)
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
			from?: number;
			to?: number;
		}): Promise<Commit[]> => {
			return new Promise<Commit[]>(async (resolve, reject) => {
				const { id, from, to } = args ? args : { id: undefined, from: undefined, to: undefined };
				const key1 = `${channel}:Commit`;
				const key2 = `${channel}:Commit:Idx`;

				const result = (id) ?
					await client.eval(get, 2, [key1, key2, id]) :
					await client.lrange(key1, from ? from : 0, to ? to : -1);
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
