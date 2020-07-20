import { Redis } from 'ioredis';
import { Card, Territories, WildCards } from '../rules';
import { isEmpty } from '..';
import { Player } from '.';

export interface Game {
	token: string;
	name: string;
	host: Player;
	round: number; // -1
	redeemed: number; // 0
	cards?: Card[]; // the deck has to be shuffled, thus need array
};

// KEYS[1] - Game (by Token)
// KEYS[2] - Game Index (by Name)
// ARGV    - toekn, name, host, round, redeemed, cards?
const put = `
local idx = 7
local rst = 0

if redis.call("hset", KEYS[2], ARGV[3], ARGV[2]) == 1 then
	rst = rst + 1
end

if redis.call("hset", KEYS[1], "token", ARGV[2]) == 1 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "name", ARGV[3]) == 1 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "host", ARGV[4]) == 1 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "round", ARGV[5]) == 1 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "redeemed", ARGV[6]) == 1 then rst = rst + 1 end

if redis.call("hset", KEYS[1], "cardsCnt", ARGV[1]) == 1 then
	rst = rst + 1
end
for i = 1, ARGV[1] do
	if redis.call("hset", KEYS[1], "cards" .. i, ARGV[idx]) == 1 then
		rst = rst + 1
	end
	idx = idx + 1
end

return rst
`;

export const GameSnapshot = {
	exists: async (client: Redis, channel: string, game: Game): Promise<boolean> =>
		(await client.hexists(`${channel}:Game:Name`, game.name) === 1),
	list: async (
		client: Redis, channel: string,
		deck: Record<Territories | WildCards, Card>,
		players?: Record<string, Player>
	): Promise<Record<string, Game>> => {
		return new Promise<Record<string, Game>>(async (resolve) => {
			const results = await client.hgetall(`${channel}:Player:Name`);
			const games: Record<string, Game> = {};
			for (const token of Object.values(results)) {
				games[token] = await GameSnapshot.get(client, channel, { token }, deck, players);
			}
			resolve(games);
		});
	},
	put: async (client: Redis, channel: string, {
		token, name, host, round, redeemed, cards
	}: Game): Promise<number> => {
		return new Promise<number>(async (resolve, reject) => {
			const card = cards ? Object.keys(cards) : [];
			const args = [
				`${channel}:Game:${token}`,
				`${channel}:Game:Name`,
				card.length,
				token, name, host.token, round, redeemed
			];
			if (cards) args.push(...card);

			const expect = 7 + card.length;
			const result = await client.eval(put, 2, args);
			if (result === expect)
				resolve(result);
			else
				reject(new Error(`[GameSnapshot] Unknown error, expect ${expect} writes from redis, got ${result}`));
		});
	},
	get: async (client: Redis, channel: string, { token, name }: {token?: string; name?: string },
		deck: Record<Territories | WildCards, Card>,
		players?: Record<string, Player>
	): Promise<Game> => {
		return new Promise<Game>(async (resolve, reject) => {
			if (!token && name) token = await client.hget(`${channel}:Game:Name`, name) || undefined;
			if (!token)
				reject(new Error(`[GameSnapshot] Unable to obtain game token for [${token} / ${name}]`));
			else if (!players)
				reject(new Error(`[GameSnapshot] Unable to get game, host is not an optional field`));
			else {
				const result = await client.hgetall(`${channel}:Game:${token}`);
				if (!isEmpty(result)) {
					const game: Game = {
						token: result.token,
						name: result.name,
						host: players[result.host],
						round: parseInt(result.round, 10),
						redeemed: parseInt(result.redeemed, 10),
					};

					const cards: Card[] = [];
					for (let i = 1; i <= parseInt(result.cardsCnt); i ++) {
						cards.push(deck[result[`cards${i}`] as Territories | WildCards]);
					}
					if (parseInt(result.cardsCnt) > 0) game.cards = cards;

					resolve(game);
				} else {
					reject(new Error(`[GameSnapshot] Failed to retrieve game ${token}`));
				}
			}
		});
	}
};
