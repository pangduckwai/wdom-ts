import { Redis } from 'ioredis';
import { Card, Territory, Territories, WildCards } from '../rules';
import { isEmpty } from '..';
import { Game } from '.';

export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	ready: boolean;
	sessionid?: string;
	joined?: Game;
	holdings?: Record<string, Territory>;
	cards?: Record<string, Card>;
};

// KEYS[1] - Player (by Token)
// KEYS[2] - Player Index (by Name)
// ARGV    - toekn, name, reinforcement, ready, sessionid?, joined?, holdings?, cards?
const put = `
local idx = 4
local rst = 0

if redis.call("hset", KEYS[2], ARGV[7], ARGV[5]) == 1 then
	rst = rst + 1
end

for i = 1, ARGV[1] - 1, 2 do
	if redis.call("hset", KEYS[1], ARGV[idx], ARGV[idx+1]) == 1 then
		rst = rst + 1
	end
	idx = idx + 2
end

if redis.call("hset", KEYS[1], "holdingsCnt", ARGV[2]) == 1 then
	rst = rst + 1
end
for i = 1, ARGV[2] do
	if redis.call("hset", KEYS[1], "holdings" .. i, ARGV[idx]) == 1 then
		rst = rst + 1
	end
	idx = idx + 1
end

if redis.call("hset", KEYS[1], "cardsCnt", ARGV[3]) == 1 then
	rst = rst + 1
end
for i = 1, ARGV[3] do
	if redis.call("hset", KEYS[1], "cards" .. i, ARGV[idx]) == 1 then
		rst = rst + 1
	end
	idx = idx + 1
end

return rst
`;

export const PlayerSnapshot = {
	exists: async (client: Redis, channel: string, player: Player): Promise<boolean> =>
		(await client.hexists(`${channel}:Player:Name`, player.name) === 1),
	list: async (
		client: Redis, channel: string,
		map: Record<Territories, Territory>,
		deck: Record<Territories | WildCards, Card>,
		games?: Record<string, Game>
	): Promise<Record<string, Player>> => {
		return new Promise<Record<string, Player>>(async (resolve) => {
			const results = await client.hgetall(`${channel}:Player:Name`);
			const players: Record<string, Player> = {};
			for (const token of Object.values(results)) {
				players[token] = await PlayerSnapshot.get(client, channel, { token }, map, deck, games);
			}
			resolve(players);
		});
	},
	put: async (client: Redis, channel: string, {
		token, name, reinforcement, ready, sessionid, joined, holdings, cards
	}: Player): Promise<number> => {
		return new Promise<number>(async (resolve, reject) => {
			const base = 8 + (sessionid ? 2 : 0) + (joined ? 2 : 0);
			const hold = holdings ? Object.keys(holdings) : [];
			const card = cards ? Object.keys(cards) : [];
			const args = [
				`${channel}:Player:${token}`,
				`${channel}:Player:Name`,
				base, hold.length, card.length,
				'token', token, 'name', name, 'reinforcement', reinforcement, 'ready', ready ? 1 : 0
			];
			if (sessionid) {
				args.push('sessionid');
				args.push(sessionid);
			}
			if (joined){
				args.push('joined');
				args.push(joined.token);
			}
			if (holdings) args.push(...hold);
			if (cards) args.push(...card);

			const expect = (base/2) + hold.length + card.length + 3;
			const result = await client.eval(put, 2, args);
			if (result === expect)
				resolve(result);
			else
				reject(new Error(`[PlayerSnapshot] Unknown error, expect ${expect} writes from redis, got ${result}`));
		});
	},
	get: async (
		client: Redis, channel: string, { token, name }: {token?: string; name?: string },
		map: Record<Territories, Territory>,
		deck: Record<Territories | WildCards, Card>,
		games?: Record<string, Game>
	): Promise<Player> => {
		return new Promise<Player>(async (resolve, reject) => {
			if (!token && name) token = await client.hget(`${channel}:Player:Name`, name) || undefined;
			if (!token)
				reject(new Error(`[PlayerSnapshot] Unable to obtain player token for  [${token} / ${name}]`));
			else {
				const result = await client.hgetall(`${channel}:Player:${token}`);
				if (!isEmpty(result)) {
					const player: Player = {
						token: result.token,
						name: result.name,
						reinforcement: parseInt(result.reinforcement, 10),
						ready: (result.ready === "1") ? true : false,
					};
					if (result.sessionid) player.sessionid = result.sessionid;
					if (result.joined && games) player.joined = games[result.joined];

					const holdings: Record<string, Territory> = {};
					for (let i = 1; i <= parseInt(result.holdingsCnt); i ++) {
						holdings[result[`cards${i}`]] = map[result[`holdings${i}`] as Territories];
					}
					if (parseInt(result.holdingsCnt) > 0) player.holdings = holdings;

					const cards: Record<string, Card> = {};
					for (let i = 1; i <= parseInt(result.cardsCnt); i ++) {
						cards[result[`cards${i}`]] = deck[result[`cards${i}`] as Territories | WildCards];
					}
					if (parseInt(result.cardsCnt) > 0) player.cards = cards;

					resolve(player);
				} else {
					reject(new Error(`[PlayerSnapshot] Failed to retrieve player ${token}`));
				}
			}
		});
	}
};
