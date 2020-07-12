require('dotenv').config();
import RedisClient, { Redis } from 'ioredis';
import { buildContinents, buildDeck, buildMap, Continents, Territories, WildCards } from '../entities';
import { Commands, Commit } from '../commits';
import { CHANNEL, CHANNEL_IDX, CommitStore } from '..';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const mockInSubscriber = jest.fn();
const commits: Commit[] = [];

let players: Record<string, Commit>;
let games: Record<string, Commit>;
let publisher: Redis;
let subscriber: Redis;
let cutoff: number;

beforeAll(async () => {
	publisher = new RedisClient({ host, port });

	subscriber = new RedisClient({ host, port });
	subscriber.on('message', (channel, message) => {
		console.log(`Subscribed: ${channel} - ${message}`);
		mockInSubscriber(channel, message);
	});

	players = {
		'bill': Commands.RegisterPlayer({ playerName: 'bill' }),
		'dave': Commands.RegisterPlayer({ playerName: 'dave' }),
		'jess': Commands.RegisterPlayer({ playerName: 'jess' }),
		'john': Commands.RegisterPlayer({ playerName: 'john' }),
		'josh': Commands.RegisterPlayer({ playerName: 'josh' }),
		'luke': Commands.RegisterPlayer({ playerName: 'luke' }),
		'matt': Commands.RegisterPlayer({ playerName: 'matt' }),
		'mike': Commands.RegisterPlayer({ playerName: 'mike' }),
		'pete': Commands.RegisterPlayer({ playerName: 'pete' }),
		'saul': Commands.RegisterPlayer({ playerName: 'saul' }),
	};
	games = {
		'bill': Commands.OpenGame({ playerToken: players['bill'].id, gameName: 'Bill\'s game' }),
		'josh': Commands.OpenGame({ playerToken: players['josh'].id, gameName: 'Josh\'s game' }),
		'luke': Commands.OpenGame({ playerToken: players['luke'].id, gameName: 'Luke\'s game' }),
		'pete': Commands.OpenGame({ playerToken: players['pete'].id, gameName: 'Pete\'s game' }),
	}
	for (const player of Object.keys(players)) {
		commits.push(players[player]);
	}
	for (const game of Object.keys(games)) {
		commits.push(games[game]);
	}
	commits.push(Commands.PlayerLeave({ playerToken: players['matt'].id }));
	commits.push(Commands.CloseGame({ playerToken: players['luke'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['dave'].id, gameToken: games['bill'].id }));
	commits.push(Commands.QuitGame({ playerToken: players['dave'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['dave'].id, gameToken: games['pete'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['jess'].id, gameToken: games['josh'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['john'].id, gameToken: games['pete'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['luke'].id, gameToken: games['pete'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['mike'].id, gameToken: games['pete'].id }));
	commits.push(Commands.JoinGame({ playerToken: players['saul'].id, gameToken: games['pete'].id }));
	commits.push(Commands.StartGame({ playerToken: players['pete'].id }));

	await new Promise((resolve) => setTimeout(() => resolve(), 100));

	let count = 0;
	for (const commit of commits) {
		count ++;
		await CommitStore.put(publisher, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		if (count === 14) {
			cutoff = Date.now();
			await new Promise((resolve) => setTimeout(() => resolve(), 50));
		}
	}
});

afterAll(async () => {
	subscriber.quit();
	publisher.quit();
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Unit test of channel ${CHANNEL} finished`);
		resolve();
	}, 1000));
});

describe('Misc tests', () => {
	it('test enum with for-in-loop', () => {
		const result = [];
		for (const item in Continents) {
			result.push(Continents[item as keyof typeof Continents]);
		}
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test enum with Object.keys() and Array.map()', () => {
		const result = Object.keys(Continents).map(key => Continents[key as keyof typeof Continents])
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test enum with Object.values()!!!', () => {
		const result = Object.values(Continents);
		console.log(result);
		expect(result.length).toEqual(6);
	});

	it('test cloning Record<K,T>', () => {
		const con1 = buildContinents();
		const con2 = buildContinents();
		con1.Europe.reinforcement = 9;
		expect(con2.Europe.reinforcement).toEqual(5);
	});

	it('test cloning Record<K,T> again', () => {
		const con1 = buildContinents();
		const con2 = buildContinents();
		con1[Continents.Asia].reinforcement = 3;
		expect(con2[Continents.Asia].reinforcement).toEqual(7);
	});

	it('test Continents initialized properly', () => {
		const world = buildContinents();
		let count = 0;
		for (const key of Object.keys(Continents)) {
			if (Continents[key as keyof typeof Continents] === world[Continents[key as keyof typeof Continents]].name) count ++;
		}
		expect(count).toEqual(6);
	});

	it('test Map initialized properly', () => {
		const map = buildMap();
		let count = 0;
		for (const key of Object.keys(Territories)) {
			if (Territories[key as keyof typeof Territories] === map[Territories[key as keyof typeof Territories]].name) count ++;
		}
		expect(count).toEqual(42);
	});

	it('test Card deck initialized properly', () => {
		const deck = buildDeck();
		let count = 0;
		for (const key of Object.keys(WildCards)) {
			if (WildCards[key as keyof typeof WildCards] === deck[WildCards[key as keyof typeof WildCards]].name) count ++
		}
		for (const key of Object.keys(Territories)) {
			if (Territories[key as keyof typeof Territories] === deck[Territories[key as keyof typeof Territories]].name) count ++
		}
		expect(count).toEqual(44);
	});
});

describe('Unit tests with redis', () => {
	it('connect to redis', async () => {
		await publisher.incr(`counter${timestamp}`);
		await publisher.incr(`counter${timestamp}`);
		await publisher.incr(`counter${timestamp}`);
		await publisher.decr(`counter${timestamp}`);
		const result = await publisher.get(`counter${timestamp}`);
		expect(result).toEqual('2');
	});

	it('read commits after a time', async () => {
		const received = await CommitStore.get(publisher, { fromTime: cutoff });
		expect(received.length).toEqual(11);
	});

	it('read commits before a timestamp', async () => {
		const received = await CommitStore.get(publisher, { toTime: cutoff });
		expect(received.length).toEqual(14);
	});

	it('write a commit to redis and receive notifications', async () => {
		expect.assertions(2);
		const commit = Commands.RegisterPlayer({ playerName: 'paul' });

		let chnl = '';
		let mssg = '{}';
		mockInSubscriber.mockImplementation((channel, message) => {
			chnl = channel;
			mssg = message;
		});

		await subscriber.subscribe(CHANNEL);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const timestamp = await CommitStore.put(publisher, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 300));
		expect(chnl).toEqual(CHANNEL);
		expect(JSON.parse(mssg)).toEqual({ id: commit.id, timestamp });
	});

	it('read commit by id (using index)', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await CommitStore.put(publisher, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const received = await CommitStore.get(publisher, { id: commit.id });
		expect({
			id: received[0].id,
			version: received[0].version,
			events: received[0].events
		}).toEqual(commit);
	});

	it('fail to put duplicated commit', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await CommitStore.put(publisher, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		await expect(CommitStore.put(publisher, commit)).rejects.toThrow(/\[CommitStore[.]write\] commit \{.*\} already exists/); // already exists
	});

	it('fail to get commit by non-existing id', async () => {
		const id = 'abcd1234';
		await expect(CommitStore.get(publisher, { id })).rejects.toThrow(`[CommitStore.get] Commit ID ${id} not found in index`);
	});

	it ('read objects of unknown type from redis', async () => {
		const fakeJson = '{"commitId":"12345","version":0,"events":["hello"]}';
		await publisher.zadd(CHANNEL, timestamp, fakeJson);
		const idx1 = await publisher.zrank(CHANNEL, fakeJson);
		if (idx1 !== null) {
			await publisher.hset(CHANNEL_IDX, '12345', idx1);
		}
		await expect(CommitStore.get(publisher, { id: '12345' })).rejects.toThrow(`[CommitStore.get] Unknown object type ${fakeJson}`);
	});

	it ('read non-JSON data from redis', async () => {
		const fakeStrg = 'This is not JSON';
		await publisher.zadd(CHANNEL, timestamp, fakeStrg);
		const idx2 = await publisher.zrank(CHANNEL, fakeStrg);
		if (idx2 !== null) {
			await publisher.hset(CHANNEL_IDX, '12346', idx2);
		}
		await expect(CommitStore.get(publisher, { id: '12346' })).rejects.toThrow(`Unexpected token T in JSON at position 0`);
	});
});
