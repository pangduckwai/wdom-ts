import { Redis } from 'ioredis';
import { Card, Territories, WildCards } from '../rules';
import { isEmpty } from '..';
import { isPlayer, Status } from '.';

export interface Game {
	token: string;
	name: string;
	host: string;
	round: number; // -1
	redeemed: number; // 0
	status: Status;
	players: string[]; // use array because use this to also remember the order of turns
	turns: number;
	cards?: Card[]; // the deck has to be shuffled, thus need array
};

export const isGame = (variable: any): variable is Game => {
	const val = variable as Game;
	return (val.token !== undefined) &&
		(val.name !== undefined) &&
		(val.host !== undefined) &&
		(val.round !== undefined) &&
		(val.redeemed !== undefined) &&
		(val.status !== undefined) &&
		(val.players !== undefined) &&
		(val.turns !== undefined);
};

// KEYS[1] - Player (by Token)
// KEYS[2] - Player Index (by Name)
const del = `
local rst = 0

if redis.call("hdel", KEYS[2], ARGV[1]) == 1 then
	rst = rst + 1
end

if redis.call("del", KEYS[1]) == 1 then
	rst = rst + 1
end

return rst`;

// KEYS[1] - Game (by Token)
// KEYS[2] - Game Index (by Name)
// ARGV    - token, name, host, round, redeemed, status, turns, players?, cards?
const put = `
local idx = 10
local rst = 0

if redis.call("hset", KEYS[2], ARGV[4], ARGV[3]) >= 0 then
	rst = rst + 1
end

if redis.call("hset", KEYS[1], "token", ARGV[3]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "name", ARGV[4]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "host", ARGV[5]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "round", ARGV[6]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "redeemed", ARGV[7]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "status", ARGV[8]) >= 0 then rst = rst + 1 end
if redis.call("hset", KEYS[1], "turns", ARGV[9]) >= 0 then rst = rst + 1 end

if redis.call("hset", KEYS[1], "cardsCnt", ARGV[1]) >= 0 then
	rst = rst + 1
end
for i = 1, ARGV[1] do
	if redis.call("hset", KEYS[1], "cards" .. i, ARGV[idx]) >= 0 then
		rst = rst + 1
	end
	idx = idx + 1
end

if redis.call("hset", KEYS[1], "playersCnt", ARGV[2]) >= 0 then
	rst = rst + 1
end
for i = 1, ARGV[2] do
	if redis.call("hset", KEYS[1], "players" .. i, ARGV[idx]) >= 0 then
		rst = rst + 1
	end
	idx = idx +1
end

return rst`;

export const GameSnapshot = (
	client: Redis,
	deck: Record<Territories | WildCards, Card>,
) => {
	return {
		exists: async (channel: string, game: Game): Promise<boolean> =>
			(await client.hexists(`${channel}:Game:Name`, game.name) === 1),
		list: (channel: string): Promise<Record<string, Game>> => {
			return new Promise<Record<string, Game>>(async (resolve) => {
				const results = await client.hgetall(`${channel}:Game:Name`);
				const games: Record<string, Game> = {};
				for (const token of Object.values(results)) {
					games[token] = await GameSnapshot(client, deck).get(channel, { token });
				}
				resolve(games);
			});
		},
		delete: (channel: string, game: Game): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
				if (game.status !== Status.Deleted) {
					reject(new Error(`[GameSnapshot] Operation mismatched: ${game.token}`));
				} else {
					const result = await client.eval(del, 2, [
						`${channel}:Game:${game.token}`,
						`${channel}:Game:Name`,
						game.name
					]);
					if (result === 2)
						resolve(result);
					else
						reject(new Error(`[GameSnapshot] Unknown error, expect 2 deletes from redis, got ${result}`));
				}
			});
		},
		put: (channel: string, {
			token, name, host, round, redeemed, status, players, turns, cards
		}: Game): Promise<number> => {
			if (status === Status.Deleted) {
				return GameSnapshot(client, deck).delete(channel, {
					token, name, host, round, redeemed, status, players, turns, cards
				});
			} else {
				return new Promise<number>(async (resolve, reject) => {
					const cnum = cards ? cards.length : 0;
					const pnum = players.length;
					const args = [
						`${channel}:Game:${token}`,
						`${channel}:Game:Name`,
						cnum, pnum,
						token, name,
						isPlayer(host) ? host.token : host,
						round, redeemed, status, turns
					];
					if (cards) args.push(...cards.map(c => c.name));
					args.push(...players.map(p => isPlayer(p) ? p.name : p));

					const expected = 10 + cnum + pnum;
					const result = await client.eval(put, 2, args);
					if (result === expected)
						resolve(result);
					else
						reject(new Error(`[GameSnapshot] Unknown error, expect ${expected} writes from redis, got ${result}`));
				});
			}
		},
		get: (channel: string, { token, name }: {token?: string; name?: string }): Promise<Game> => {
			return new Promise<Game>(async (resolve, reject) => {
				if (!token && name) token = await client.hget(`${channel}:Game:Name`, name) || undefined;
				if (!token)
					reject(new Error(`[GameSnapshot] Unable to obtain game token for [${token} / ${name}]`));
				// else if (!players)
				// 	reject(new Error(`[GameSnapshot] Unable to get game, host is not an optional field`));
				else {
					const result = await client.hgetall(`${channel}:Game:${token}`);
					if (!isEmpty(result)) {
						const game: Game = {
							token: result.token,
							name: result.name,
							host: result.host,
							round: parseInt(result.round, 10),
							redeemed: parseInt(result.redeemed, 10),
							status: parseInt(result.status),
							players: [],
							turns: parseInt(result.turns, 10)
						};

						const cards: Card[] = [];
						for (let i = 1; i <= parseInt(result.cardsCnt); i ++) {
							cards.push(deck[result[`cards${i}`] as Territories | WildCards]);
						}
						if (cards.length > 0) game.cards = cards;

						for (let i = 1; i <= parseInt(result.playersCnt); i ++) {
							game.players.push(result[`players${i}`]);
						}

						resolve(game);
					} else {
						reject(new Error(`[GameSnapshot] Failed to retrieve game ${token}`));
					}
				}
			});
		}
	};
};
