import { Redis } from 'ioredis';
import { Game, Player, isGame, isPlayer } from '../rules';
import { deserialize } from '..';

// KEYS[1]  - Player snapshots
// KEYS[2]  - Game snapshots
// KEYS[3]  - Is Busy
// ARGV[1]  - Number of player records (thus the rest are game records)
// ARGV[2.. - Key value pair of token and serialized object
const take = `
local next = ARGV[1] + 2
local count = 0

redis.call("del", KEYS[1])
redis.call("del", KEYS[2])

for i = 2, ARGV[1], 2 do
	if redis.call("hset", KEYS[1], ARGV[i], ARGV[i+1]) >= 0 then
		count = count + 1
	end
end

for j = next, #ARGV, 2 do
	if redis.call("hset", KEYS[2], ARGV[j], ARGV[j+1]) >= 0 then
		count = count + 1
	end
end

redis.call("del", KEYS[3])
return count`;

// KEYS[1]  - Player's session ID
// KEYS[2]  - Player snapshots
// KEYS[3]  - Game snapshots
// KEYS[4]  - Is Busy
// result[0] plyrs - plyrs[1|3|5...] serialized player objects
// result[1] games - games[1|3|5...] serialized game objects
const read = `
local isbusy = redis.call("get", KEYS[4])
if isbusy then
	return nil
else
	local result = {}
	local login = redis.call("hgetall", KEYS[1])
	local plyrs = redis.call("hgetall", KEYS[2])
	local games = redis.call("hgetall", KEYS[3])
	table.insert(result, login)
	table.insert(result, plyrs)
	table.insert(result, games)
	return result
end
`;

export type Snapshot = {
	take: ({ players, games }: {
		players: Record<string, Player>,
		games: Record<string, Game>
	}) => Promise<number>,
	read: () => Promise<{
		players: Record<string, Player>,
		games: Record<string, Game>
	}>,
	auth: (sessionId?: string) => Promise<{
		playerToken: string,
		players: Record<string, Player>,
		games: Record<string, Game>
	}>
};

const readSnapshot = (channel: string, client: Redis): Promise<{
	logins: Record<string, string>,
	players: Record<string, Player>,
	games: Record<string, Game>
}> => {
	return new Promise<{
		logins: Record<string, string>,
		players: Record<string, Player>,
		games: Record<string, Game>
	}>(async (resolve, reject) => {
		const rtrn: {
			logins: Record<string, string>,
			players: Record<string, Player>,
			games: Record<string, Game>
		} = {
			logins: {},
			players: {},
			games: {}
		};
		const args = [
			`${channel}:Login`,
			`${channel}:Player`,
			`${channel}:Game`,
			`${channel}:Busy`
		];

		let retry = 5;
		let result;
		do {
			retry --;
			await new Promise((resolve) => setTimeout(() => resolve(), 100));
			result = await client.eval(read, 4, args);
		} while (!result && retry > 0);

		if (!result) {
			reject(new Error('Snapshot still busy...'));
		} else if ((result.length != 3) || (result[0].length & 1) || (result[1].length & 1) || (result[2].length & 1)) {
			reject(new Error('Invalid result format returned from redis')); // length of result[0], result[1], result[2] must be even
		} else {
			for (let h = 0; h < result[0].length; h += 2) {
				rtrn.logins[result[0][h]] = result[0][h + 1];
			}
			try {
				for (let i = 1; i < result[1].length; i += 2) {
					const player = deserialize('[Snapshot]', result[1][i], isPlayer);
					rtrn.players[player.token] = player;
				}
				for (let j = 1; j < result[2].length; j += 2) {
					const game = deserialize('[Snapshot]', result[2][j], isGame);
					rtrn.games[game.token] = game;
				}
				resolve(rtrn);
			} catch (error) {
				reject(new Error(error));
			}
		}
	});
};

export const getSnapshot = (
	channel: string,
	client: Redis
): Snapshot => {
	return {
		take: ({
			players, games
		}: {
			players: Record<string, Player>,
			games: Record<string, Game>
		}): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
				const playerList = Object.values(players).filter(p => p.status !== 'Deleted').filter(p => !!p.sessionid);
				const gameList = Object.values(games).filter(g => g.status !== 'Deleted');
				const args = [
					`${channel}:Player`,
					`${channel}:Game`,
					`${channel}:Busy`,
					playerList.length * 2
				];

				for (const player of playerList) {
					args.push(player.token);
					args.push(JSON.stringify(player));
				}
				for (const game of gameList) {
					args.push(game.token);
					args.push(JSON.stringify(game));
				}

				const result = await client.eval(take, 3, args);
				if (result === (playerList.length + gameList.length))
					resolve(result);
				else
					reject(new Error(`[Snapshot] Unknown error, expect ${playerList.length + gameList.length} writes from redis, got ${result}`));
			});
		},
		read: (): Promise<{
			players: Record<string, Player>,
			games: Record<string, Game>
		}> => readSnapshot(channel, client),
		auth: async (sessionId?: string): Promise<{
			playerToken: string,
			players: Record<string, Player>,
			games: Record<string, Game>
		}> => {
			const { logins, players, games } = await readSnapshot(channel, client);
			return new Promise<{
				playerToken: string,
				players: Record<string, Player>,
				games: Record<string, Game>
			}>(async (resolve, reject) => {
				if (!sessionId || !logins[sessionId] || !players[logins[sessionId]]) {
					reject('Authentication error');
				} else if ((players[logins[sessionId]].status !== 'New') && (players[logins[sessionId]].status !== 'Ready')) {
					reject(`Invalid player (status: ${players[logins[sessionId]].status})`);
				} else {
					resolve({ playerToken: logins[sessionId], players, games });
				}
			});
		}
	};
};
