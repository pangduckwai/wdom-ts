require('dotenv').config();
jest.mock('../rules/card');
import RedisClient, { Redis } from 'ioredis';
import { fromEventPattern, Observable, Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { Commands, Commit, CommitStore, isNotification, Notification, toCommits } from '../commands';
import { Game, Message, Player, Subscriptions } from '../queries';
import { buildContinents, buildDeck, buildMap, Card, Continents, _shuffle, shuffle, Territories, WildCards } from '../rules';
import { CHANNEL, deserialize, isEmpty } from '..';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const map = buildMap();
const deck = buildDeck();
const cards = shuffle<WildCards | Territories, Card>(deck);
const playerNames = ['pete', 'josh', 'saul', 'jess', 'bill', 'matt', 'nick', 'dick', 'dave', 'john', 'mike'];
const gameHosts: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'], // 'nick', 'mike', 'john', 'saul'
	'saul': ['nick', 'mike', 'john']
};

afterAll(async () => {
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Unit test of channel ${CHANNEL} finished`);
		resolve();
	}, 1000));
});

describe('Registering player tests', () => {
	const channel = `${CHANNEL}CMT`;
	const mockInSubscriber = jest.fn();
	const players: Record<string, Commit> = {};
	const games: Record<string, Commit> = {};
	let subscribed: Commit[] = [];
	let publisher: Redis;
	let subscriber: Redis;
	let commitStore: {
		put: (channel: string, commit: Commit) => Promise<Commit>,
		get: (channel: string, args?: { id?: string; fromTime?: number; toTime?: number}) => Promise<{
			index: number;
			commit: Commit;
		}[]>
	};

	beforeAll(async () => {
		publisher = new RedisClient({ host, port });
		subscriber = new RedisClient({ host, port });
		subscriber.on('message', (channel, message) => {
			// console.log(`Subscribed: ${channel} - ${message}`);
			mockInSubscriber(channel, message);
		});

		mockInSubscriber.mockImplementation((channel, message) => {
			subscribed.push(JSON.parse(message));
		});

		await subscriber.subscribe(channel);
		commitStore = CommitStore(publisher);
	});

	afterAll(async () => {
		await subscriber.quit();
		await publisher.quit();
	});

	it('subscription preserve commits order', async () => {
		for (const playerName of playerNames) {
			const commit = await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
			if (commit) players[playerName] = commit;
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		const result: string[] = [];
		for (const msg of subscribed) {
			for (const evt of msg.events) {
				result.push(evt.payload.playerName);
			}
		}
		expect(result).toEqual(Object.keys(players));
	});

	it('subscription match inputs', async () => {
		const compare: Record<string, Commit> = {};
		for (const result of subscribed) {
			for (const evt of result.events) {
				compare[evt.payload.playerName] = result;
			}
		}
		expect(compare).toEqual(players);
	});

	it('get commit by id match inputs', async () => {
		const commit = await commitStore.get(channel, { id: players['josh'].id });
		expect(commit.length).toEqual(1);
		expect(commit[0].commit).toEqual(players['josh']);
	});

	it('subscription match reading from redis directly', async () => {
		const results = await commitStore.get(channel);
		expect(results.map(r => r.commit)).toEqual(subscribed);
	});

	it('reading from redis directly match inputs', async () => {
		const results = await commitStore.get(channel);
		const compare: Record<string, Commit> = {};
		for (const result of results) {
			for (const evt of result.commit.events) {
				compare[evt.payload.playerName] = result.commit;
			}
		}
		expect(compare).toEqual(players);
	});

	it('player leave game', async () => {
		subscribed = [];
		for (const playerName of ['bill', 'dave']) {
			const commit = await commitStore.put(channel, Commands.PlayerLeave({ playerToken: players[playerName].id }));
			// if (commit) delete players[playerName];
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		const result: string[] = [];
		for (const msg of subscribed) {
			for (const evt of msg.events) {
				result.push(evt.payload.playerToken);
			}
		}
		expect(result).toEqual([players['bill'].id, players['dave'].id]);
	});

	it('players open games', async () => {
		subscribed = [];
		for (const hostName of Object.keys(gameHosts)) {
			const playerToken = players[hostName].id;
			const gameName = `${hostName}'s game`;
			const commit = await commitStore.put(channel, Commands.OpenGame({ playerToken, gameName }));
			if (commit) games[hostName] = commit;
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		const result: string[] = [];
		for (const msg of subscribed) {
			for (const evt of msg.events) {
				result.push(evt.payload.gameName);
			}
		}
		expect(result).toEqual(Object.values(games).map(g => g.events[0].payload.gameName));
	});

	it('players join games', async () => {
		subscribed = [];
		for (const hostName of Object.keys(gameHosts)) {
			for (const playerName of gameHosts[hostName]) {
				const playerToken = players[playerName].id;
				const gameToken = games[hostName].id;
				const commit = await commitStore.put(channel, Commands.JoinGame({ playerToken, gameToken }));
			}
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		const result: string[] = [];
		for (const msg of subscribed) {
			for (const evt of msg.events) {
				result.push(Object.values(players).filter(p => p.id === msg.events[0].payload.playerToken)[0].events[0].payload.playerName);
			}
		}
		const expected: string[] = [];
		for (const gh of Object.values(gameHosts)) {
			expected.push(...gh);
		}
		expect(expected).toEqual(result);
	});

	it('player start game', async () => {
		subscribed = [];
		const playerToken = players['saul'].id;
		const gameToken = games['saul'].id;
		const commit = await commitStore.put(channel, Commands.StartGame({ playerToken, gameToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		// console.log(JSON.stringify(subscribed, null, ' '));
	});
});

describe('rxjs tests', () => {
	const channel = `${CHANNEL}Rx`;
	const players: Record<string, Commit> = {};
	let received: Notification[] = [];
	let publisher: Redis;
	let subscriber: Redis;
	let commitStore: {
		put: (channel: string, commit: Commit) => Promise<Commit>,
		pub: (channel: string, commit: Commit) => Promise<Commit>,
		get: (channel: string, args?: { id?: string; fromTime?: number; toTime?: number}) => Promise<{
			index: number;
			commit: Commit;
		}[]>
	};
	let source$: Observable<any>;
	let subscribe$: Subscription;

	beforeAll(async () => {
		publisher = new RedisClient({ host, port });
		subscriber = new RedisClient({ host, port });
		commitStore = CommitStore(publisher);

		source$ = fromEventPattern(
			handler => {
				subscriber.on('message', (channel: string, message: string) => {
					handler({ channel, message });
				});
				subscriber.subscribe(channel)
					.then(x => console.log('Redis subscribed', x))
					.catch(e => console.log(e));
			},
			_ => {
				subscriber.unsubscribe(channel)
					.then(x => console.log('Redis unsubscribed', x))
					.catch(e => console.log(e));
			}
		);

		subscribe$ = source$
			.pipe(
				debounceTime(100)
			)
			.subscribe({
				next: event => {
					received.push(deserialize('Commit Test', event.message, isNotification));
					console.log(event);
				},
				error: error => console.log(error),
				complete: () => console.log('complete!')
			});
	});

	afterAll(async () => {
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		subscribe$.unsubscribe();
		await subscriber.quit();
		await publisher.quit();
	});

	it('test', async () => {
		for (const playerName of playerNames) {
			const commit = await commitStore.pub(channel, Commands.RegisterPlayer({ playerName: playerName }));
			if (commit) players[playerName] = commit;
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		expect(received.length).toEqual(1);
	});

	it('player leave game', async () => {
		for (const playerName of ['bill', 'dave']) {
			const commit = await commitStore.pub(channel, Commands.PlayerLeave({ playerToken: players[playerName].id }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		expect(received.length).toEqual(2);
	});
});

describe('subscriptions tests', () => {
	const channel = `${CHANNEL}Scb`;
	let publisher: Redis;
	let subscriber: Redis;
	let commitStore: {
		put: (channel: string, commit: Commit) => Promise<Commit>,
		pub: (channel: string, commit: Commit) => Promise<Commit>,
		get: (channel: string, args?: { id?: string; fromTime?: number; toTime?: number}) => Promise<{
			index: number;
			commit: Commit;
		}[]>
	};
	let subscriptions: {
		start: (channel: string) => Promise<number>;
		stop: (channel: string) => Promise<void>;
		report: (channel: string) => Promise<{
			ready: boolean;
			players: Record<string, Player>;
			games: Record<string, Game>;
			messages: Message[];
		}>;
	};
	let reports: {
		ready: boolean;
		players: Record<string, Player>;
		games: Record<string, Game>;
		messages: Message[];
	};

	beforeAll(async () => {
		publisher = new RedisClient({ host, port });
		subscriber = new RedisClient({ host, port });
		commitStore = CommitStore(publisher);
		subscriptions = Subscriptions(publisher, map, deck);

		await subscriptions.start(channel)
	});

	afterAll(async () => {
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		subscriptions.stop(channel);
		await subscriber.quit();
		await publisher.quit();
	});

	it('subscriptions test - players registered', async () => {
		for (const playerName of playerNames) {
			const commit = await commitStore.pub(channel, Commands.RegisterPlayer({ playerName: playerName }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.players).map(p => p.name).sort()).toEqual(playerNames.sort());
	});

	it('subscriptions test - players left', async () => {
		for (const player of Object.values(reports.players).filter(p => p.name === 'bill' || p.name === 'dave')) {
			await commitStore.pub(channel, Commands.PlayerLeave({ playerToken: player.token }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.players).filter(p => p.status === 0).map(p => p.name).sort()).toEqual(['bill', 'dave']);
	});
});