import { Redis } from 'ioredis';
import { deserialize, generateToken } from '..';
import { BaseEvent } from '.';

export interface Commit {
	id: string;
	version: number;
	session: string;
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
// KEYS[4] - Login (session -> token)
// KEYS[5] - Login (token -> session)
// ARGV[1] - Serialized commit object
// ARGV[2] - Timestamp offset
// ARGV[3] - Player Token
// ARGV[4] - New session ID
const put = `
local sid = redis.call("xadd", KEYS[2], "*", "commit", ARGV[1])
if sid then
	redis.call("set", KEYS[3], sid, "px", 3000)
	redis.call("publish", KEYS[1], sid)

	local cnt = 0
	local expire = redis.call("xrange", KEYS[2], "-", ARGV[2])
	for i = 1, #expire do
		cnt = cnt + redis.call("xdel", KEYS[2], expire[i][1])
	end

	local auth = -1
	local sssn = redis.call("hget", KEYS[5], ARGV[3])
	if sssn then
		redis.call("hdel", KEYS[4], sssn)
		if redis.call("hset", KEYS[4], ARGV[4], ARGV[3]) >= 0 then
			auth = redis.call("hset", KEYS[5], ARGV[3], ARGV[4])
		end
	else
		if redis.call("hset", KEYS[4], ARGV[4], sid) >= 0 then
			auth = redis.call("hset", KEYS[5], sid, ARGV[4])
		end
	end

	if auth >= 0 then
		return sid
	else
		return redis.error_reply("[CommitStore] error writing session")
	end
else
	return redis.error_reply("[CommitStore] error writing commit")
end`;

export type CommitStore = {
	put: (commit: Commit, sessionId: string, playerToken: string) => Promise<Commit>,
	get: (args?: { id?: string; from?: string; to?: string}) => Promise<Commit[]>
};

export const getCommitStore = (channel: string, client: Redis, ttl?: number): CommitStore => {
	const _ttl = ttl ? ttl : 86400000; // 1 day == 24x60x60x1000 milliseconds
	return {
		put: (commit: Commit, sessionId: string, playerToken?: string): Promise<Commit> => {
			return new Promise<Commit>(async (resolve, reject) => {
				const timestamp = Date.now();
				const offset = '' + (timestamp - _ttl);
				try {
					const result = await client.eval(put, 5, [
						channel,
						`${channel}:Commit`,
						`${channel}:Busy`,
						`${channel}:Login`,
						`${channel}:LoginRev`,
						JSON.stringify(commit),
						offset,
						playerToken || '[none]',
						sessionId
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
		get: (args?: {
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
						resolve(toCommits('[CommitStore]', results.map(result => [result[0], result[1][1]])));
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

interface AddEvent {
	build: ({ put }: CommitStore) => Promise<Commit>;
	addEvent: <E extends BaseEvent>(event: E) => this;
}

export const createCommit = (): {
	addEvent: <E extends BaseEvent>(event: E) => AddEvent;
} => {
	const commit: Commit = {
		id: '',
		version: 0,
		session: '',
		events: []
	};

	const build = async ({ put }: CommitStore): Promise<Commit> => {
		if (commit.events.length < 1)
			return new Promise<Commit>((_, reject) => {
				reject(new Error('[createCommit] Invalid parameter(s)'));
			});
		else {
			const playerToken = commit.events[0].payload.playerToken || commit.events[0].payload.fromPlayer;
			commit.session = generateToken(128);
			return put(commit, commit.session, playerToken);
		}
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
