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
	const commits: Record<string, Commit> = {};
	const subscribed: Commit[] = [];
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
		// await new Promise((resolve) => setTimeout(() => resolve(), 100));

		commitStore = CommitStore(publisher);
		for (const playerName of playerNames) {
			const commit = await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
			if (commit) commits[playerName] = commit;
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
	});

	afterAll(async () => {
		await subscriber.quit();
		await publisher.quit();
	});

	it('subscription preserve commits order', () => {
		const result: string[] = [];
		for (const msg of subscribed) {
			for (const evt of msg.events) {
				result.push(evt.payload.playerName);
			}
		}
		expect(result).toEqual(Object.keys(commits));
	});

	it('subscription match inputs', async () => {
		const compare: Record<string, Commit> = {};
		for (const result of subscribed) {
			for (const evt of result.events) {
				compare[evt.payload.playerName] = result;
			}
		}
		expect(compare).toEqual(commits);
	});

	it('get commit by id match inputs', async () => {
		const commit = await commitStore.get(channel, { id: commits['josh'].id });
		expect(commit.length).toEqual(1);
		expect(commit[0].commit).toEqual(commits['josh']);
	});

	it('subscription match reading from redis directly', async () => {
		const results = await commitStore.get(channel);
		console.log(JSON.stringify(results, null, ' '));
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
		expect(compare).toEqual(commits);
	});
});