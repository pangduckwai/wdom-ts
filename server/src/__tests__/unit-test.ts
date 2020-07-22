require('dotenv').config();
jest.mock('../rules/card');
import RedisClient, { Redis } from 'ioredis';
import { Commands, Commit, CommitStore, isNotification, toCommits } from '../commands';
import { Game, Player, PlayerSnapshot, reducer, GameSnapshot, MessageType, MessageSnapshot, Subscription, Status } from '../queries';
import { buildContinents, buildDeck, buildMap, Continents, shuffleDeck, Territories, WildCards } from '../rules';
import { CHANNEL, isEmpty } from '..';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const mockInSubscriber = jest.fn();
const map = buildMap();
const deck = buildDeck();
const cards = shuffleDeck(deck);

afterAll(async () => {
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
		const con1 = buildContinents();
		const con2 = buildContinents();
		con1['Europe'].reinforcement = 9;
		expect(con2['Europe'].reinforcement).toEqual(5);
	});

	it('test cloning Record<K,T> again', () => {
		const con1 = buildContinents();
		const con2 = buildContinents();
		con1['Asia'].reinforcement = 3;
		expect(con2['Asia'].reinforcement).toEqual(7);
	});

	it('test Continents initialized properly', () => {
		const world = buildContinents();
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
			status: Status.New
		};
		const list = shuffleDeck(deck);
		for (let i = 0; i < 5; i ++) {
			const card = list.pop();
			if (card && player.cards) player.cards[card.name] = card;
		}
		const type = (player.cards) ? player.cards['Middle-East'].type : 999;
		expect(type).toEqual(1);
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
	let publisher0: Redis;

	beforeAll(async () => {
		publisher0 = new RedisClient({ host, port });
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
	});

	afterAll(async () => {
		await publisher0.quit();
	});

	it('test non-existing hash', async () => {
		const result = await publisher0.hgetall('NONEXISTING');
		expect(isEmpty(result)).toBeTruthy();
	});

	it('test writing object to hash', async () => {
		const result1 = await publisher0.hset(`${CHANNEL}TEST1`, '12345', 'Hello how are you');
		const result2 = await publisher0.hset(`${CHANNEL}TEST1`, '12345', 'Hello how are you');
		const result3 = await publisher0.hset(`${CHANNEL}TEST1`, '12345', 'Hello how are me');
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const result4 = await publisher0.hget(`${CHANNEL}TEST1`, '12345');
		expect(result1).toBeTruthy();
		expect(result2).toBeFalsy();
		expect(result3).toBeFalsy();
		expect(result4).toEqual('Hello how are me');
	});

	it('test non-existing field in hash', async () => {
		const result = await publisher0.hget(`${CHANNEL}TEST1`, '12346');
		expect(result).toBeNull();
	});

	it('connect to redis', async () => {
		await publisher0.incr(`counter${timestamp}`);
		await publisher0.incr(`counter${timestamp}`);
		await publisher0.incr(`counter${timestamp}`);
		await publisher0.decr(`counter${timestamp}`);
		const result = await publisher0.get(`counter${timestamp}`);
		expect(result).toEqual('2');
	});
});

describe('Unit tests with redis', () => {
	const stamps: number[] = [];
	let publisher1: Redis;
	let subscriber: Redis;
	let cutoff: number;
	let players: Record<string, Commit>;
	let games: Record<string, Commit>;

	beforeAll(async () => {
		publisher1 = new RedisClient({ host, port });
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

		const commits: Commit[] = [];
		for (const player of Object.keys(players)) {
			commits.push(players[player]);
		}
		for (const game of Object.keys(games)) {
			commits.push(games[game]);
		}
		commits.push(Commands.PlayerLeave({ playerToken: players['matt'].id }));
		commits.push(Commands.CloseGame({ playerToken: players['luke'].id, gameToken: games['luke'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['dave'].id, gameToken: games['bill'].id }));
		commits.push(Commands.QuitGame({ playerToken: players['dave'].id, gameToken: games['bill'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['dave'].id, gameToken: games['pete'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['jess'].id, gameToken: games['josh'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['john'].id, gameToken: games['pete'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['luke'].id, gameToken: games['pete'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['mike'].id, gameToken: games['pete'].id }));
		commits.push(Commands.JoinGame({ playerToken: players['saul'].id, gameToken: games['pete'].id }));
		commits.push(Commands.StartGame({ playerToken: players['pete'].id, gameToken: games['pete'].id }));

		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		let count = 0;
		for (const commit of commits) {
			count ++;
			await CommitStore(publisher1).put(CHANNEL, commit);
			await new Promise((resolve) => setTimeout(() => resolve(), 100));
			if (count === 14) {
				cutoff = Date.now();
				await new Promise((resolve) => setTimeout(() => resolve(), 50));
			}
		}
	});

	afterAll(async () => {
		await subscriber.quit();
		await publisher1.quit();
	});

	it('read commits after a time', async () => {
		const received = await CommitStore(publisher1).get(CHANNEL, { fromTime: cutoff });
		expect(received.length).toEqual(11);
	});

	it('read commits before a timestamp', async () => {
		const received = await CommitStore(publisher1).get(CHANNEL, { toTime: cutoff });
		expect(received.length).toEqual(14);
	});

	it('read all commits', async () => {
		const received = await CommitStore(publisher1).get(CHANNEL);
		expect(received.length).toEqual(25);
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

		await subscriber.subscribe(`${CHANNEL}1`);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const c = await CommitStore(publisher1).put(`${CHANNEL}1`, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 300));
		expect(chnl).toEqual(`${CHANNEL}1`);
		expect(JSON.parse(mssg)).toEqual({ id: commit.id, timestamp: c.timestamp });
	});

	it('read commit by id (using index)', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await CommitStore(publisher1).put(CHANNEL, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const received = await CommitStore(publisher1).get(CHANNEL, { id: commit.id });
		expect(received[0]).toEqual(commit);
	});

	it('fail to put duplicated commit', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await CommitStore(publisher1).put(CHANNEL, commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		delete commit.timestamp;

		await expect(CommitStore(publisher1).put(CHANNEL, commit)).rejects.toThrow(/\[CommitStore\] commit \{.*\} already exists/);
	});

	it('fail to get commit by non-existing id', async () => {
		const id = 'abcd1234';
		await expect(CommitStore(publisher1).get(CHANNEL, { id })).rejects.toThrow(`[CommitStore] Commit ID ${id} not found in index`);
	});

	it ('read objects of unknown type from redis', async () => {
		const fakeJson = '{"commitId":"12345","version":0,"events":["hello"]}';
		await publisher1.zadd(`${CHANNEL}:Commit`, timestamp, fakeJson);
		const idx1 = await publisher1.zrank(`${CHANNEL}:Commit`, fakeJson);
		if (idx1 !== null) {
			await publisher1.hset(`${CHANNEL}:Commit:Idx`, '12345', idx1);
		}
		await expect(CommitStore(publisher1).get(CHANNEL, { id: '12345' })).rejects.toThrow(`[CommitStore] Unknown object type ${fakeJson}`);
	});

	it('read non-JSON data from redis', async () => {
		const fakeStrg = 'This is not JSON';
		await publisher1.zadd(`${CHANNEL}:Commit`, timestamp, fakeStrg);
		const idx2 = await publisher1.zrank(`${CHANNEL}:Commit`, fakeStrg);
		if (idx2 !== null) {
			await publisher1.hset(`${CHANNEL}:Commit:Idx`, '12346', idx2);
		}
		await expect(CommitStore(publisher1).get(CHANNEL, { id: '12346' })).rejects.toThrow(`Unexpected token T in JSON at position 0`);
	});

	it('write Player object into redis', async () => {
		expect.assertions(1);

		const player: Player = {
			token: '12345',
			name: 'Player One',
			reinforcement: 0,
			status: Status.New,
			cards: {},
		};
		for (let i = 0; i < 3; i ++) {
			const card = cards.pop();
			if (card && player.cards) player.cards[card.name] = card;
		}
		const result = await PlayerSnapshot(map, deck).put(publisher1, `${CHANNEL}3`, player)
			.catch(error => console.log('ERROR', error));
		expect(result).toEqual(10);
	});

	it('read Player object from redis', async () => {
		const expected: Player = {
			token: '12345',
			name: 'Player One',
			reinforcement: 0,
			status: Status.New,
			cards: {
				'Ontario': { name: 'Ontario', type: 1 },
				'Wildcard-2': { name: 'Wildcard-2', type: 0 },
				'Northwest-Territory': { name: 'Northwest-Territory', type: 2 }
			},
		};
		const player = await PlayerSnapshot(map, deck).get(publisher1, `${CHANNEL}3`, { token: '12345' });
		console.log(player);
		expect(player).toEqual(expected);
	});

	it('write one more player to redis', async () => {
		expect.assertions(1);

		const player: Player = {
			token: '12346',
			name: 'Player Two',
			reinforcement: 0,
			status: Status.New,
			cards: {},
		};
		for (let i = 0; i < 3; i ++) {
			const card = cards.pop();
			if (card && player.cards) player.cards[card.name] = card;
		}
		const result = await PlayerSnapshot(map, deck).put(publisher1, `${CHANNEL}3`, player)
			.catch(error => console.log('ERROR', error));
		expect(result).toEqual(10);
	});

	it('list players', async () => {
		const result = await PlayerSnapshot(map, deck).list(publisher1, `${CHANNEL}3`);
		for (const player of Object.values(result)) {
			console.log('List players:', JSON.stringify(player, null, ' '));
		}
		expect(Object.values(result).length).toEqual(2);
	});

	it('write Game object into redis', async () => {
		const players = await PlayerSnapshot(map, deck).list(publisher1, `${CHANNEL}3`);
		const game: Game = {
			token: '67890',
			name: 'Game One',
			host: players['12345'],
			round: -1,
			redeemed: 0,
			status: Status.New,
			cards: shuffleDeck(deck)
		};
		players['12345'].joined = game;
		const result = await GameSnapshot(deck).put(publisher1, `${CHANNEL}3`, game)
			.catch(error => console.log('ERROR', error));
		expect(result).toEqual(52);
	});

	it('read Game object from redis', async () => {
		const players = await PlayerSnapshot(map, deck).list(publisher1, `${CHANNEL}3`);
		const game = await GameSnapshot(deck).get(publisher1, `${CHANNEL}3`, { token: '67890' });
		expect(game.token).toEqual('67890');
		expect(game.name).toEqual('Game One');
		expect(game.host).toEqual('12345');
		expect(game.round).toEqual(-1);
		expect(game.redeemed).toEqual(0);
		expect(game.cards?.length).toEqual(44);
	});

	it('list games', async () => {
		const players = await PlayerSnapshot(map, deck).list(publisher1, `${CHANNEL}3`);
		const result = await GameSnapshot(deck).list(publisher1, `${CHANNEL}3`);
		for (const game of Object.values(result)) {
			console.log('List game:', JSON.stringify(game, null, ' '));
		}
		expect(Object.values(result).length).toEqual(1);
	});

	it('write messages into redis', async () => {
		const messages = [{
			commitId: '9990001', type: MessageType.Message, message: 'Hello how are you'
		}, {
			commitId: '9990002', type: MessageType.Message, message: 'This is your last warning'
		}, {
			commitId: '9990002', type: MessageType.Error, message: 'See? I told you that was the last warning'
		}, {
			commitId: '9990003', type: MessageType.Error, message: 'All errors from now on'
		}];
		for (const message of messages) {
			await new Promise((resolve) => setTimeout(() => resolve(), 100));
			const result = await MessageSnapshot.put(publisher1, `${CHANNEL}3`, message);
			if (result.timestamp) stamps.push(result.timestamp);
			expect(result.timestamp).toBeDefined();
		}
	});

	it('list all messages', async () => {
		const result = await MessageSnapshot.get(publisher1, `${CHANNEL}3`);
		console.log('List all messages', JSON.stringify(result, null, ' '));
		expect(result.length).toEqual(4);
	});

	it('get messages before a time', async () => {
		const result = await MessageSnapshot.get(publisher1, `${CHANNEL}3`, { toTime: stamps[1] });
		console.log(`Get messages before ${stamps[1]}`, JSON.stringify(result, null, ' '));
		expect(result.length).toEqual(2);
	});

	it('get messages after a time', async () => {
		const result = await MessageSnapshot.get(publisher1, `${CHANNEL}3`, { fromTime: stamps[2] });
		console.log(`Get messages after ${stamps[1]}`, JSON.stringify(result, null, ' '));
		expect(result.length).toEqual(2);
	});

	it('get messages by commitIds', async () => {
		const commitId = '9990002';
		const result = await MessageSnapshot.get(publisher1, `${CHANNEL}3`, { commitId });
		console.log(`Get messages of ${commitId}`, JSON.stringify(result, null, ' '));
		expect(result.length).toEqual(2);
	});
});

describe('Subscription tests', () => {
	let publisher2: Redis;
	let commitStore;
	let subscription: any;

	beforeAll(async () => {
		publisher2 = new RedisClient({ host, port });
		commitStore = CommitStore(publisher2);
		subscription = Subscription(publisher2, map, deck);
		await subscription.start(`${CHANNEL}5`);
	});

	afterAll(async () => {
		await subscription.stop(`${CHANNEL}5`);
		await publisher2.quit();
	});

	it('create 3 players then delete one', async () => {
		const commit1 = await CommitStore(publisher2).put(`${CHANNEL}5`, Commands.RegisterPlayer({ playerName: 'john' }));
		const commit2 = await CommitStore(publisher2).put(`${CHANNEL}5`, Commands.RegisterPlayer({ playerName: 'joe' }));
		const commit3 = await CommitStore(publisher2).put(`${CHANNEL}5`, Commands.RegisterPlayer({ playerName: 'josh' }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		const commit4 = await CommitStore(publisher2).put(`${CHANNEL}5`, Commands.PlayerLeave({ playerToken: commit2.id }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		const result = await PlayerSnapshot(map, deck).list(publisher2, `${CHANNEL}5`);
		console.log('Create 3 players then delete one', JSON.stringify(result, null, ' '));
		expect(Object.values(result).length).toEqual(2);
	});
});

	// it('write commits to redis, receive notifications, calculate snapshots', async () => {
	// 	// expect.assertions(2);

	// 	let lastPos: number = -1;
	// 	let splayers: Record<string, Player> = {};
	// 	let sgames: Record<string, Game> = {};
	// 	let serrors: Record<string, Errors> = {};
	// 	mockInSubscriber.mockImplementation((channel, message) => {
	// 		const noti = JSON.parse(message);
	// 		if (isNotification(noti)) {
	// 			publisher12.zrangebyscore(
	// 				channel, (lastPos >= 0) ? lastPos : '-inf', noti.timestamp, 'WITHSCORES', (error, result) => {
	// 					if (error) {
	// 						console.log(`[EntitiesDS.subscriber.on - message]: ${error}`);
	// 					} else {
	// 						const incomings = toCommits('[EntitiesDS.subscriber.on - message]', result);
	// 						const { players, games, errors } = reducer(incomings, { players: splayers, games: sgames, errors: serrors });
	// 						splayers = players;
	// 						sgames = games;
	// 						serrors = errors;
	// 					}
	// 				}
	// 			);
	// 			lastPos = noti.timestamp + 1;
	// 		}
	// 	});

	// 	await subscriber.subscribe(`${CHANNEL}2`);
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 100));

	// 	const commit0 = Commands.RegisterPlayer({ playerName: 'john' });
	// 	const commit1 = Commands.RegisterPlayer({ playerName: 'pete' });
	// 	const commit2 = Commands.RegisterPlayer({ playerName: 'josh' });
	// 	const commit4 = Commands.RegisterPlayer({ playerName: 'jess' });
	// 	const commit3 = Commands.OpenGame({ playerToken: commit2.id, gameName: 'Josh\'s game' });
	// 	const commit5 = Commands.OpenGame({ playerToken: commit4.id, gameName: 'Josh\'s game' });
	// 	const commit6 = Commands.OpenGame({ playerToken: commit0.id, gameName: 'John\'s game' });
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit0);
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, Commands.RegisterPlayer({ playerName: 'john' }));
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit1);
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit2);
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, Commands.PlayerLeave({ playerToken: commit1.id }));
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit4);
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit3);
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit5);
	// 	await CommitStore.put(publisher1, `${CHANNEL}2`, commit6);
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 300));

	// 	console.log('HA0', lastPos);
	// 	console.log('HA1', splayers);
	// 	// console.log('HA2', sgames);
	// 	console.log('HA3', serrors);

	// 	expect(Object.values(splayers).map(p => p.name)).toEqual(['john', 'josh', 'jess']);

	// 	expect(Object.values(sgames).map(g => g.name)).toEqual(['Josh\'s game', 'John\'s game']);

	// 	expect(Object.values(serrors).map(e => e.message)).toEqual([
	// 		'Player john already registered', 'Game Josh\'s game already exists'
	// 	]);

	// 	let tcard = null;
	// 	for (let i = 0; i < 5; i ++) {
	// 		const card = sgames[commit3.id].cards.pop();
	// 		if (i === 4) tcard = card;
	// 	}
	// 	expect(tcard?.name).toEqual('Middle-East');
	// });
