require('dotenv').config();
jest.mock('../rules/card');
import RedisClient, { Redis } from 'ioredis';
import { Commands, Commit, CommitStore, isNotification, toCommits } from '../commands';
import { Game, Player, PlayerSnapshot, reducer, GameSnapshot, Message, MessageType, MessageSnapshot, Subscription, Status } from '../queries';
import { buildContinents, buildDeck, buildMap, Card, Continents, _shuffle, shuffle, Territories, WildCards } from '../rules';
import { CHANNEL, isEmpty } from '..';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const map = buildMap();
const deck = buildDeck();
const channel = `${CHANNEL}R`

const playerNames = ['pete', 'josh', 'saul', 'jess', 'bill', 'matt', 'nick', 'dick', 'dave', 'john', 'mike'];
const gameHosts: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'], // 'nick', 'mike', 'john', 'saul'
	'saul': ['nick', 'mike', 'john']
};

const commits: Record<string, Commit> = {};
let publisher: Redis;
let commitStore: {
	put: (channel: string, commit: Commit) => Promise<Commit>,
	get: (channel: string, args?: { id: string; fromTime: number; toTime: number}) => Promise<Commit[]>
};
let subscription: {
	start: (channel: string) => Promise<number>,
	stop: (channel: string) => Promise<void>,
	report: (channel: string) => Promise<{
		ready: boolean;
		players: Record<string, Player>;
		games: Record<string, Game>;
		messages: Message[];
	}>
};
// let players: Record<string, Player> = {};
// let games: Record<string, Game> = {};

beforeAll(async () => {
	console.log('Channel', channel);
	publisher = new RedisClient({ host, port });
	commitStore = CommitStore(publisher);
	subscription = Subscription(publisher, map, deck);
	await subscription.start(channel);
});

afterAll(async () => {
	await subscription.stop(channel);
	await publisher.quit();
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Reducer test of channel ${channel} finished`);
		resolve();
	}, 1000));
});

describe('Reducer tests', () => {
	it('players registered', async () => {
		// Register player
		for (const playerName of playerNames) {
			const commit = await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
			if (commit) commits[playerName] = commit;
			// await new Promise((resolve) => setTimeout(() => resolve(), 50));
		}
		console.log('A', Object.keys(commits));
		await new Promise((resolve) => setTimeout(() => resolve(), 300));
		const report = await subscription.report(channel)
			.then(report => report)
			.catch(error => console.log(error));
		const p = (report) ? Object.values(report.players).map(p => p.name) : [];
		console.log('B', p);
		expect(p).toEqual(playerNames);
	});

	// it('players leave', async () => {
	// 	for (const playerName of ['bill', 'dave']) {
	// 		await commitStore.put(channel, Commands.PlayerLeave({ playerToken: commits[playerName].id }));
	// 	}
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 300));
	// 	const report = await subscription.report(channel)
	// 		.then(report => report)
	// 		.catch(error => console.log(error));
	// 	const p = (report) ? Object.values(report.players).filter(p => p.status !== Status.Deleted).map(p => p.name) : [];
	// 	expect(p).toEqual(playerNames.filter(n => (n !== 'bill' && n !== 'dave')));
	// });
});
