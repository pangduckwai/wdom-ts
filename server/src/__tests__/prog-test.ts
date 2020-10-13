require('dotenv').config();
jest.mock('../rules/card');
import crypto from 'crypto';
import RedisClient, { Redis } from 'ioredis';
import { isEmpty } from '..';
import { getCommitStore, CommitStore, createCommit, TerritorySelected } from '../commands';
import { buildWorld, buildDeck, buildMap, Card, Continents, Game, Player, _shuffle, shuffle, Territories, WildCards } from '../rules';

const CHANNEL = `wdom${Date.now()}`;
const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const map = buildMap();
const deck = buildDeck();
const topic = `${CHANNEL}progtest`;

let publisher: Redis;

beforeAll(async () => {
	publisher = new RedisClient({ host, port });
	await new Promise((resolve) => setTimeout(() => resolve(), 100));
});

afterAll(async () => {
	await publisher.quit();
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Unit test of channel ${CHANNEL} finished`);
		resolve();
	}, 1000));
});

describe('Programming behaviour tests', () => {
	it('test enum with for-in-loop', () => {
		const result = [];
		for (const item in Continents) {
			result.push(Continents[item]);
		}
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test enum with for-of-loop', () => {
		const result = [];
		for (const item of Continents) {
			result.push(item);
		}
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test enum with Object.keys() and Array.map()', () => {
		const result = Object.keys(Continents)
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test enum with Object.values()!!!', () => {
		const result = Object.values(Continents);
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test cloning Record<K,T>', () => {
		const con1 = buildWorld();
		const con2 = buildWorld();
		con1['Europe'].reinforcement = 9;
		expect(con2['Europe'].reinforcement).toEqual(5);
	});

	it('test cloning Record<K,T> again', () => {
		const con1 = buildWorld();
		const con2 = buildWorld();
		con1['Asia'].reinforcement = 3;
		expect(con2['Asia'].reinforcement).toEqual(7);
	});

	it('test Continents initialized properly', () => {
		const world = buildWorld();
		let count = 0;
		for (const item of Object.values(Continents)) {
			if (item === world[item].name) count ++;
		}
		expect(count).toEqual(6);
	});

	it('test Map initialized properly', () => {
		let count = 0;
		for (const item of Object.values(Territories)) {
			if (item === map[item].name) count ++;
		}
		expect(count).toEqual(42);
	});

	it('test Card deck initialized properly', () => {
		let count = 0;
		for (const key of Object.values(WildCards)) {
			if (key === deck[key].name) count ++
		}
		for (const key of Object.values(Territories)) {
			if (key === deck[key].name) count ++
		}
		expect(count).toEqual(44);
	});

	it('test Object.values()', () => {
		const list = Object.values(deck);
		console.log(list[21]);
		expect(list.length).toEqual(44);
	});

	it('test Player draw Cards', () => {
		const player: Player = {
			token: '12345',
			name: 'Player One',
			reinforcement: 0,
			cards: {},
			holdings: [],
			status: 'New',
		};
		const list = shuffle<WildCards | Territories, Card>(deck);
		for (let i = 0; i < 5; i ++) {
			const card = list.pop();
			if (card) player.cards[card.name] = card;
		}
		const type = player.cards['Western-United-States'].type;
		expect(type).toEqual('Artillery');
	});

	it('test isEmpty', () => {
		const v1 = {};
		const v2 = null;
		const v3 = undefined;
		const v4 = {1:2};
		const v5 = '';
		expect(isEmpty(v1)).toBeTruthy();
		expect(isEmpty(v2)).toBeTruthy();
		expect(isEmpty(v3)).toBeTruthy();
		expect(isEmpty(v4)).toBeFalsy();
		expect(isEmpty(v5)).toBeTruthy();
	});

	it('test const assertion', () => {
		// This won't work: _shuffle(Territories);
		const s = Territories.map(t => t);
		const t = _shuffle(s);
		console.log('const assertion', t);
		expect(t[29]).toEqual('Siberia');
	});

	it('test const assertion again', () => {
		let count = 0
		for (const card of [...WildCards, ...Territories]) {
			if (count === 9) expect(card).toEqual('China');
			count ++;
		}
	});

	it('test random number', () => {
		const buf = crypto.randomBytes(16);
		console.log(`${buf.length} -- ${buf.toString('hex')}`);
		const token = crypto.createHash('sha256').update(crypto.randomBytes(16).toString('hex')).digest('base64');
		console.log(token);
	});

	it('test random number 2', () => {
		const result: number[] = [];
		for (let i = 0; i < 100; i++) {
			const buf = parseInt(crypto.randomBytes(3).toString('hex'), 16);
			result.push(buf);
		}
		console.log(`${result}`);
	});

	it('test random number 3', () => {
		const max = (parseInt('ffffff', 16) + 1); // 16777216
		// const onesixth = max / 6; // 8388608
		console.log(max);
		const result: number[] = [];
		for (let i = 0; i < 100; i++) {
			const buf = Math.floor(parseInt(crypto.randomBytes(3).toString('hex'), 16) * 6 / max) + 1;
			result.push(buf);
		}
		console.log(`${result}`);
	});

	it('test array', () => {
		const buf: string[] = [];
		buf[4] = 'Hallo';
		console.log(buf.length, buf[1], buf[4], buf);
	});

	it('redis script test error reply', async () => {
		const lua = `
if redis.call("get", KEYS[1]) then
	return "Okay..."
else
	return redis.error_reply("Error!!!")
end`;
		await expect(publisher.eval(lua, 1, "isverybusy")).rejects.toThrow('Error!!!');
	});

	it('redis script test return nil', async () => {
		const lua = `
if redis.call("get", KEYS[1]) then
	return "Okay..."
else
	return nil
end`;
		expect(await publisher.eval(lua, 1, "isverybusy")).toBeNull();
	});

	it('redis script test xadd', async () => {
		const lua = `return redis.call("xadd", KEYS[1], "*", "commit", "Hello world")`;
		const result = await publisher.eval(lua, 1, 'xadd-test');
		expect(result.endsWith('-0')).toBeTruthy();
	});

	it('redis script test xrange', async () => {
		const lua = `return redis.call("xadd", KEYS[1], "*", "commit", "Hello world")`;
		const sid: string = await publisher.eval(lua, 1, topic);
		const results = await publisher.xrange(topic, sid, sid);
		const output = results.map(result => [result[0], result[1][1]]);
		console.log(`redis script test xrange\n${JSON.stringify(output, null, ' ')}\nresult[0][0] : ${output[0][0]}\nresult[0][1] : ${output[0][1]}`);
		expect(output[0][1]).toEqual('Hello world');
	});

	it('redis script test xrange out of range', async () => {
		const result = await publisher.xrange(topic, '-', '1297493938077');
		expect(result.length).toEqual(0);
	});

	it('redis script test xrange wrong key', async () => {
		const result = await publisher.xrange('xrange-text', '-', '+');
		expect(result.length).toEqual(0);
	});

	it('test hgetall', async () => {
		const put = `
local count = 0
for i = 1, #ARGV, 2 do
	if redis.call("hset", KEYS[1], ARGV[i], ARGV[i+1]) >= 0 then
		count = count + 1
	end
end
return count`;
		const args = [
			`${topic}:Player`,
			'X001', 'Hello',
			'X002', 'There',
			'X003', 'How',
			'X004', 'Are',
			'X005', 'You?'
		];
		const count = await publisher.eval(put, 1, args);
		expect(count).toEqual(5);
		const result = await publisher.hgetall(`${topic}:Player`);
		expect(result).toEqual({"X001":"Hello","X002":"There","X003":"How","X004":"Are","X005":"You?"});
	});

	it('test invalid territory name', async () => {
		const func = (territoryName: string) => {
			const commitStore: CommitStore = getCommitStore(topic, publisher);
			return createCommit().addEvent<TerritorySelected>({
				type: 'TerritorySelected',
				payload: { playerToken: '12345', gameToken: '54321', territory: territoryName as Territories }
			}).build(commitStore);
		}
		const result = await func('Lalaland');
		console.log(JSON.stringify(result, null, ' '));
	});

	it('test crypto', () => {
		console.log(crypto.randomBytes(16).toString('base64'));
	});
});
