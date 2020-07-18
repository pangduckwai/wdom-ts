require('dotenv').config();
jest.mock('../queries/card');
import RedisClient, { Redis } from 'ioredis';
import { Commands, Commit, CommitStore, isNotification, toCommits } from '../commands';
import { buildContinents, buildDeck, buildMap, Continents, Errors, Game, Player, reducer, shuffleDeck, Territories, WildCards } from '../queries';
import { CHANNEL, isEmpty } from '..';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const mockInSubscriber = jest.fn();
const commits: Commit[] = [];

let players: Record<string, Commit>;
let games: Record<string, Commit>;
let publisher1: Redis;
let publisher2: Redis;
let subscriber: Redis;
let cutoff: number;

beforeAll(async () => {
	publisher1 = new RedisClient({ host, port });
	publisher2 = new RedisClient({ host, port });

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
		await CommitStore.put(publisher1, CHANNEL, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		if (count === 14) {
			cutoff = Date.now();
			await new Promise((resolve) => setTimeout(() => resolve(), 50));
		}
	}
});

afterAll(async () => {
	subscriber.quit();
	publisher2.quit();
	publisher1.quit();
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Unit test of channel ${CHANNEL} finished`);
		resolve();
	}, 1000));
});

describe('Programming behaviour tests', () => {
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

	it('test Object.values()', () => {
		const deck = buildDeck();
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
			ready: true
		};
		const deck = shuffleDeck();
		for (let i = 0; i < 5; i ++) {
			const card = deck.pop();
			if (card) player.cards[card.name] = card;
		}
		console.log(player.cards[Territories.MiddleEast]);
		expect(player.cards[Territories.MiddleEast].type).toEqual(1);
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
});

describe('Redis client tests', () => {
	it('test non-existing hash', async () => {
		const result = await publisher1.hgetall('NONEXISTING');
		expect(isEmpty(result)).toBeTruthy();
	});

	it('test writing object to hash', async () => {
		const result1 = await publisher1.hset(`${CHANNEL}TEST1`, '12345', 'Hello how are you');
		const result2 = await publisher1.hset(`${CHANNEL}TEST1`, '12345', 'Hello how are you');
		const result3 = await publisher1.hset(`${CHANNEL}TEST1`, '12345', 'Hello how are me');
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const result4 = await publisher1.hget(`${CHANNEL}TEST1`, '12345');
		expect(result1).toBeTruthy();
		expect(result2).toBeFalsy();
		expect(result3).toBeFalsy();
		expect(result4).toEqual('Hello how are me');
	});

	it('test non-existing field in hash', async () => {
		const result = await publisher1.hget(`${CHANNEL}TEST1`, '12346');
		console.log('HM', result);
	});

	it('connect to redis', async () => {
		await publisher1.incr(`counter${timestamp}`);
		await publisher1.incr(`counter${timestamp}`);
		await publisher1.incr(`counter${timestamp}`);
		await publisher1.decr(`counter${timestamp}`);
		const result = await publisher1.get(`counter${timestamp}`);
		expect(result).toEqual('2');
	});
});

describe('Unit tests with redis', () => {
	it('read commits after a time', async () => {
		const received = await CommitStore.get(publisher1, CHANNEL, { fromTime: cutoff });
		expect(received.length).toEqual(11);
	});

	it('read commits before a timestamp', async () => {
		const received = await CommitStore.get(publisher1, CHANNEL, { toTime: cutoff });
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
		const c = await CommitStore.put(publisher1, CHANNEL, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 300));
		expect(chnl).toEqual(CHANNEL);
		expect(JSON.parse(mssg)).toEqual({ id: commit.id, timestamp: c.timestamp });
	});

	it('read commit by id (using index)', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await CommitStore.put(publisher1, CHANNEL, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const received = await CommitStore.get(publisher1, CHANNEL, { id: commit.id });
		expect(received[0]).toEqual(commit);
	});

	it('fail to put duplicated commit', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await CommitStore.put(publisher1, CHANNEL, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		delete commit.timestamp;

		await expect(CommitStore.put(publisher1, CHANNEL, commit)).rejects.toThrow(/\[CommitStore lua\] commit \{.*\} already exists/);
	});

	it('fail to get commit by non-existing id', async () => {
		const id = 'abcd1234';
		await expect(CommitStore.get(publisher1, CHANNEL, { id })).rejects.toThrow(`[CommitStore.get] Commit ID ${id} not found in index`);
	});

	it ('read objects of unknown type from redis', async () => {
		const fakeJson = '{"commitId":"12345","version":0,"events":["hello"]}';
		await publisher1.zadd(CHANNEL, timestamp, fakeJson);
		const idx1 = await publisher1.zrank(CHANNEL, fakeJson);
		if (idx1 !== null) {
			await publisher1.hset(`${CHANNEL}CommitIdx`, '12345', idx1);
		}
		await expect(CommitStore.get(publisher1, CHANNEL, { id: '12345' })).rejects.toThrow(`[CommitStore.get] Unknown object type ${fakeJson}`);
	});

	it('read non-JSON data from redis', async () => {
		const fakeStrg = 'This is not JSON';
		await publisher1.zadd(CHANNEL, timestamp, fakeStrg);
		const idx2 = await publisher1.zrank(CHANNEL, fakeStrg);
		if (idx2 !== null) {
			await publisher1.hset(`${CHANNEL}CommitIdx`, '12346', idx2);
		}
		await expect(CommitStore.get(publisher1, CHANNEL, { id: '12346' })).rejects.toThrow(`Unexpected token T in JSON at position 0`);
	});

	it('write commits to redis, receive notifications, calculate snapshots', async () => {
		// expect.assertions(2);

		let lastPos: number = -1;
		let splayers: Record<string, Player> = {};
		let sgames: Record<string, Game> = {};
		let serrors: Record<string, Errors> = {};
		mockInSubscriber.mockImplementation((channel, message) => {
			const noti = JSON.parse(message);
			if (isNotification(noti)) {
				publisher2.zrangebyscore(
					channel, (lastPos >= 0) ? lastPos : '-inf', noti.timestamp, 'WITHSCORES', (error, result) => {
						if (error) {
							console.log(`[EntitiesDS.subscriber.on - message]: ${error}`);
						} else {
							const incomings = toCommits('[EntitiesDS.subscriber.on - message]', result);
							const { players, games, errors } = reducer(incomings, { players: splayers, games: sgames, errors: serrors });
							splayers = players;
							sgames = games;
							serrors = errors;
						}
					}
				);
				lastPos = noti.timestamp + 1;
			}
		});

		await subscriber.subscribe(`${CHANNEL}2`);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		const commit0 = Commands.RegisterPlayer({ playerName: 'john' });
		const commit1 = Commands.RegisterPlayer({ playerName: 'pete' });
		const commit2 = Commands.RegisterPlayer({ playerName: 'josh' });
		const commit4 = Commands.RegisterPlayer({ playerName: 'jess' });
		const commit3 = Commands.OpenGame({ playerToken: commit2.id, gameName: 'Josh\'s game' });
		const commit5 = Commands.OpenGame({ playerToken: commit4.id, gameName: 'Josh\'s game' });
		const commit6 = Commands.OpenGame({ playerToken: commit0.id, gameName: 'John\'s game' });
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit0);
		await CommitStore.put(publisher1, `${CHANNEL}2`, Commands.RegisterPlayer({ playerName: 'john' }));
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit1);
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit2);
		await CommitStore.put(publisher1, `${CHANNEL}2`, Commands.PlayerLeave({ playerToken: commit1.id }));
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit4);
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit3);
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit5);
		await CommitStore.put(publisher1, `${CHANNEL}2`, commit6);
		await new Promise((resolve) => setTimeout(() => resolve(), 300));

		console.log('HA0', lastPos);
		console.log('HA1', splayers);
		// console.log('HA2', sgames);
		console.log('HA3', serrors);

		expect(Object.values(splayers).map(p => p.name)).toEqual(['john', 'josh', 'jess']);

		expect(Object.values(sgames).map(g => g.name)).toEqual(['Josh\'s game', 'John\'s game']);

		expect(Object.values(serrors).map(e => e.message)).toEqual([
			'Player john already registered', 'Game Josh\'s game already exists'
		]);

		let tcard = null;
		for (let i = 0; i < 5; i ++) {
			const card = sgames[commit3.id].cards.pop();
			if (i === 4) tcard = card;
		}
		expect(tcard?.name).toEqual('Middle-East');
	});

});
