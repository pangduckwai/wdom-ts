require('dotenv').config();
jest.mock('../rules/card');
import RedisClient, { Redis } from 'ioredis';
import { Commands, Commit, CommitStore, isNotification, toCommits } from '../commands';
import { buildContinents, buildDeck, buildMap, Card, Continents, _shuffle, shuffle, Territories, WildCards } from '../rules';
import { CHANNEL, isEmpty } from '..';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const map = buildMap();
const deck = buildDeck();
const cards = shuffle<WildCards | Territories, Card>(deck);
const channel = `${CHANNEL}CMT`;
const playerNames = ['pete', 'josh', 'saul', 'jess', 'bill', 'matt', 'nick', 'dick', 'dave', 'john', 'mike'];
const gameHosts: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'], // 'nick', 'mike', 'john', 'saul'
	'saul': ['nick', 'mike', 'john']
};

afterAll(async () => {
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Unit test of channel ${channel} finished`);
		resolve();
	}, 1000));
});

describe('Registering player tests', () => {
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
			const commit = await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
			if (commit) delete players[playerName];
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 100));

		const result: string[] = [];
		for (const msg of subscribed) {
			for (const evt of msg.events) {
				result.push(evt.payload.playerName);
			}
		}
		expect(result).toEqual(['bill', 'dave']);
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

		console.log(JSON.stringify(subscribed, null, ' '));
	});
});
