require('dotenv').config();
import RedisClient, { Redis } from 'ioredis';
import { CHANNEL, CommitsDS } from '../data-src';
import { Commands, Commit } from '../model';

const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const mockInSubscriber = jest.fn();
const commits: Commit[] = [];
let players: Record<string, Commit>;
let games: Record<string, Commit>;
let publisher: Redis;
let subscriber: Redis;
let dataSrc: CommitsDS;
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
	dataSrc = new CommitsDS(publisher);

	let count = 0;
	for (const commit of commits) {
		count ++;
		await dataSrc.put(commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 300));
		if (count === 14) {
			cutoff = Date.now();
			await new Promise((resolve) => setTimeout(() => resolve(), 150));
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

describe('Unit Test', () => {
	it('connect to redis', async () => {
		await publisher.incr(`counter${timestamp}`);
		await publisher.incr(`counter${timestamp}`);
		await publisher.incr(`counter${timestamp}`);
		await publisher.decr(`counter${timestamp}`);
		const result = await publisher.get(`counter${timestamp}`);
		expect(result).toEqual('2');
	});

	it('read commits after a timestamp', async () => {
		const received = await dataSrc.get({ fromTime: cutoff });
		expect(received.length).toEqual(11);
	});

	it('read commits before a timestamp', async () => {
		const received = await dataSrc.get({ toTime: cutoff });
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
		await dataSrc.put(commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 300));
		expect(chnl).toEqual(CHANNEL);
		expect(JSON.parse(mssg)).toEqual({ id: commit.id, timestamp: commit.timestamp });
	});

	it('read commit by id (using index)', async () => {
		const commit = Commands.RegisterPlayer({ playerName: 'patt' });

		await dataSrc.put(commit);
		await new Promise((resolve) => setTimeout(() => resolve(), 100));
		const received = await dataSrc.get({ id: commit.id });
		expect(received[0]).toEqual(commit);
	});
});