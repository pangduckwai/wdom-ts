import { Redis } from 'ioredis';
import { Card, Territory, Territories, WildCards } from '../rules';
import { isEmpty } from '..';
import { Status } from '.';

export interface Player {
	token: string;
	name: string;
	reinforcement: number; // 0
	status: Status;
	sessionid?: string;
	joined?: string;
	holdings?: Record<string, Territory>;
	cards?: Record<string, Card>;
};

export const isPlayer = (variable: any): variable is Player => {
	const val = variable as Player;
	return (val.token !== undefined) &&
		(val.name !== undefined) &&
		(val.reinforcement !== undefined) &&
		(val.status !== undefined);
};

// KEYS[1] - Player (by Token)
// KEYS[2] - Player Index (by Name)
// ARGV[1] - name
const del = `
local rst = 0

if redis.call("hdel", KEYS[2], ARGV[1]) == 1 then
	rst = rst + 1
end

if redis.call("del", KEYS[1]) == 1 then
	rst = rst + 1
end

return rst`;

// KEYS[1] - Player (by Token)
// KEYS[2] - Player Index (by Name)
// ARGV    - toekn, name, reinforcement, status, sessionid?, joined?, holdings?, cards?
const put = `
local idx = 4
local rst = 0

if redis.call("hset", KEYS[2], ARGV[7], ARGV[5]) >= 0 then
	rst = rst + 1
end

for i = 1, ARGV[1] - 1, 2 do
	if redis.call("hset", KEYS[1], ARGV[idx], ARGV[idx+1]) >= 0 then
		rst = rst + 1
	end
	idx = idx + 2
end

if redis.call("hset", KEYS[1], "holdingsCnt", ARGV[2]) >= 0 then
	rst = rst + 1
end
for i = 1, ARGV[2] do
	if redis.call("hset", KEYS[1], "holdings" .. i, ARGV[idx]) >= 0 then
		rst = rst + 1
	end
	idx = idx + 1
end

if redis.call("hset", KEYS[1], "cardsCnt", ARGV[3]) >= 0 then
	rst = rst + 1
end
for i = 1, ARGV[3] do
	if redis.call("hset", KEYS[1], "cards" .. i, ARGV[idx]) >= 0 then
		rst = rst + 1
	end
	idx = idx + 1
end

return rst`;

export const PlayerSnapshot = (
	client: Redis,
	map: Record<Territories, Territory>,
	deck: Record<Territories | WildCards, Card>
) => {
	return {
		exists: async (channel: string, player: Player): Promise<boolean> =>
			(await client.hexists(`${channel}:Player:Name`, player.name) === 1),
		list: (channel: string): Promise<Record<string, Player>> => {
			return new Promise<Record<string, Player>>(async (resolve) => {
				const results = await client.hgetall(`${channel}:Player:Name`);
				const players: Record<string, Player> = {};
				for (const token of Object.values(results)) {
					players[token] = await PlayerSnapshot(client, map, deck).get(channel, { token });
				}
				resolve(players);
			});
		},
		delete: (channel: string, player: Player): Promise<number> => {
			return new Promise<number>(async (resolve, reject) => {
				if (player.status !== Status.Deleted) {
					reject(new Error(`[PlayerSnapshot] Operation mismatched: ${player.token}`));
				} else {
					const result = await client.eval(del, 2, [
						`${channel}:Player:${player.token}`,
						`${channel}:Player:Name`,
						player.name
					]);
					if (result === 2)
						resolve(result);
					else
						reject(new Error(`[PlayerSnapshot] Unknown error, expect 2 deletes from redis, got ${result}`));
				}
			});
		},
		put: (channel: string, {
			token, name, reinforcement, status, sessionid, joined, holdings, cards
		}: Player): Promise<number> => {
			if (status === Status.Deleted) {
				return PlayerSnapshot(client, map, deck).delete(channel, {
					token, name, reinforcement, status, sessionid, joined, holdings, cards
				});
			} else {
				return new Promise<number>(async (resolve, reject) => {
					const base = 8 + (sessionid ? 2 : 0) + (joined ? 2 : 0);
					const hold = holdings ? Object.keys(holdings) : [];
					const card = cards ? Object.keys(cards) : [];
					const args = [
						`${channel}:Player:${token}`,
						`${channel}:Player:Name`,
						base, hold.length, card.length,
						'token', token, 'name', name, 'reinforcement', reinforcement, 'status', status
					];
					if (sessionid) {
						args.push('sessionid');
						args.push(sessionid);
					}
					if (joined){
						args.push('joined');
						args.push(joined);
					}
					if (holdings) args.push(...hold);
					if (cards) args.push(...card);

					const expected = (base/2) + hold.length + card.length + 3;
					const result = await client.eval(put, 2, args);
					if (result === expected)
						resolve(result);
					else
						reject(new Error(`[PlayerSnapshot] Unknown error, expect ${expected} writes from redis, got ${result}`));
				});
			}
		},
		get: (channel: string, { token, name }: {token?: string; name?: string }): Promise<Player> => {
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
							status: parseInt(result.status, 10),
						};
						if (result.sessionid) player.sessionid = result.sessionid;
						if (result.joined) player.joined = result.joined;

						const holdings: Record<string, Territory> = {};
						for (let i = 1; i <= parseInt(result.holdingsCnt); i ++) {
							holdings[result[`cards${i}`]] = map[result[`holdings${i}`] as Territories];
						}
						if (Object.keys(holdings).length > 0) player.holdings = holdings;

						const cards: Record<string, Card> = {};
						for (let i = 1; i <= parseInt(result.cardsCnt); i ++) {
							cards[result[`cards${i}`]] = deck[result[`cards${i}`] as Territories | WildCards];
						}
						if (Object.keys(cards).length > 0) player.cards = cards;

						resolve(player);
					} else {
						reject(new Error(`[PlayerSnapshot] Failed to retrieve player ${token}`));
					}
				}
			});
		}
	};
};
