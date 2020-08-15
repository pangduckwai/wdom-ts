import { Redis } from 'ioredis';
import { deserialize } from '..';
import { Game, Player, isGame, isPlayer } from '.';

// KEYS[1]  - Player snapshots
// KEYS[2]  - Game snapshots
// KEYS[3]  - Is Busy
// ARGV[1]  - Number of player records (thus the rest are game records)
// ARGV[2.. - Key value pair of token and serialized object
const put = `
local next = ARGV[1] + 2
local count = 0

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

del KEYS[3]
return count`;

export const Snapshot = (
	client: Redis
) => {
	return {
    take: (channel: string, {
      players, games
    }: {
      players: Record<string, Player>,
      games: Record<string, Game>
    }): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
        const playerList = Object.values(players);
        const gameList = Object.values(games);
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

				const result = await client.eval(put, 3, args);
				if (result === (playerList.length + gameList.length))
					resolve(result);
				else
					reject(new Error(`[Snapshot] Unknown error, expect ${playerList.length + gameList.length} writes from redis, got ${result}`));
			});
		},
		read: (channel: string): Promise<{
      players: Record<string, Player>,
      games: Record<string, Game>
    }> => {
			return new Promise<{
        players: Record<string, Player>,
        games: Record<string, Game>
      }>(async (resolve, reject) => {
				const recp = await client.hgetall(`${channel}:Player`);
				const recg = await client.hgetall(`${channel}:Game`);
				const rtrn: {
          players: Record<string, Player>,
          games: Record<string, Game>
        } = {
          players: {},
          games: {}
        };

        try {
          for (const str of Object.values(recp)) {
            const player = deserialize('[Snapshot]', str, isPlayer);
            rtrn.players[player.token] = player;
          }
          for (const str of Object.values(recg)) {
            const game = deserialize('[Snapshot]', str, isGame);
            rtrn.games[game.token] = game;
          }
					resolve(rtrn);
				} catch (error) {
					reject(new Error(error));
				}
			});
		}
	};
};
