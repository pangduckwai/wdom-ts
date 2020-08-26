import { Redis } from 'ioredis';
import { deserialize } from '..';
import { Game, Player, isGame, isPlayer, Status } from '.';

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

// KEYS[1]  - Player snapshots
// KEYS[2]  - Game snapshots
// KEYS[3]  - Is Busy
// result[0] plyrs - plyrs[1|3|5...] serialized player objects
// result[1] games - games[1|3|5...] serialized game objects
const read = `
local isbusy = redis.call("get", KEYS[3])
if isbusy then
	return nil
else
	local result = {}
	local plyrs = redis.call("hgetall", KEYS[1])
	local games = redis.call("hgetall", KEYS[2])
	table.insert(result, plyrs)
	table.insert(result, games)
	return result
end
`;

export type Snapshot = {
	take: ({ players, games }: { players: Record<string, Player>, games: Record<string, Game>}) => Promise<number>,
	read: () => Promise<{ players: Record<string, Player>, games: Record<string, Game>}>
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
				const playerList = Object.values(players).filter(p => p.status !== Status.Deleted);
				const gameList = Object.values(games).filter(g => g.status !== Status.Deleted);
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
		}> => {
			return new Promise<{
				players: Record<string, Player>,
				games: Record<string, Game>
			}>(async (resolve, reject) => {
				const rtrn: {
					players: Record<string, Player>,
					games: Record<string, Game>
				} = {
					players: {},
					games: {}
				};

				let retry = 5;
				let result = await client.eval(read, 3, [`${channel}:Player`, `${channel}:Game`, `${channel}:Busy`]);
				while (!result && retry > 0) {
					retry --;
					await new Promise((resolve) => setTimeout(() => resolve(), 100));
					result = await client.eval(read, 3, [`${channel}:Player`, `${channel}:Game`, `${channel}:Busy`]);
				}

				if (!result) {
					reject(new Error('Snapshot still busy...'));
				} else if ((result.length != 2) || (result[0].length & 1) || (result[1].length & 1)) {
					reject(new Error('Invalid result format returned from redis')); // length of result[0] and result[1] must be even
				} else {
					try {
						for (let i = 1; i < result[0].length; i += 2) {
							const player = deserialize('[Snapshot]', result[0][i], isPlayer);
							rtrn.players[player.token] = player;
						}
						for (let j = 1; j < result[1].length; j += 2) {
							const game = deserialize('[Snapshot]', result[1][j], isGame);
							rtrn.games[game.token] = game;
						}
						resolve(rtrn);
					} catch (error) {
						reject(new Error(error));
					}
				}
			});
		}
	};
};
