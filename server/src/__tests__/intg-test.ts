require('dotenv').config();
jest.mock('../rules/card');
jest.mock('../rules/rules');
jest.mock('../commands/index');
import RedisClient, { Redis } from 'ioredis';
// import { fromEventPattern, Observable, Subscription } from 'rxjs';
// import { debounceTime, filter } from 'rxjs/operators';
import { BusyTimeout, Commands, Commit, getCommands, getCommitStore, toCommits } from '../commands';
import { Game, getSnapshot, getSubscriptions, Message, Player, Snapshot, Subscriptions } from '../queries';
import { buildDeck, buildMap, buildWorld, Card, rules, _shuffle, shuffle, Territories, WildCards } from '../rules';
import { CHANNEL, deserialize, isEmpty } from '..';

const output = (
	reports: {
		players: Record<string, Player>;
		games: Record<string, Game>;
		messages: Message[];
	},
	hostName: string) => {
		const x = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
		const y = Object.values(reports.games).filter(g => g.host === x)[0].token;
		const g = reports.games[y];
		const output = 
	`* "${g.name}" [status: ${g.status}] [round: ${g.round}] [turn: ${g.turns}] [redeemed: ${g.redeemed}]
	 Members:${g.players.map(k => {
		const p = reports.players[k];
		return `\n ${k === x ? '*' : '-' } "${p.name}" [status: ${p.status}] [reinforcement: ${p.reinforcement}] [joined: "${(p.joined ? reports.games[p.joined].name : '')}"] [selected: ${reports.players[k].selected}]
	....holdings:${Object.values(p.holdings).map(t => ` ${t.name}[${t.troop}]`)}
	....cards   :${Object.values(p.cards).map(c => `${c.name}(${c.type})`)}`;
	})}`;
		console.log(output.replace(/[.][.][.][.]/gi, '  '));
	
		let message = '';
		for (let i = ((reports.messages.length - 5) > 0 ? reports.messages.length - 5 : 0); i < reports.messages.length; i ++) {
			message += `${reports.messages[i].commitId} ${reports.messages[i].type} ${reports.messages[i].eventName} ${reports.messages[i].message}\n`;
		}
		if (reports.messages.length > 0) console.log(message);
	};
	
const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const timestamp = Date.now();
const world = buildWorld();
const map = buildMap();
const deck = buildDeck();

const playerNames = ['pete', 'josh', 'saul', 'jess', 'bill', 'matt', 'nick', 'dick', 'dave', 'john', 'mike'];
const gameHosts: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'], // 'nick', 'mike', 'john', 'saul'
	'saul': ['nick', 'mike', 'john']
};

const channel = `${CHANNEL}intg`;
let publisher: Redis;
let subscriber: Redis;
let commands: Commands;
let snapshot: Snapshot;
let subscriptions: Subscriptions;
let reports: {
	players: Record<string, Player>;
	games: Record<string, Game>;
	messages: Message[];
};

beforeAll(async () => {
	publisher = new RedisClient({ host, port });
	subscriber = new RedisClient({ host, port });
	commands = getCommands(getCommitStore(channel, publisher));
	snapshot = getSnapshot(channel, publisher);
	subscriptions = getSubscriptions(publisher, world, map, deck);
	reports = {
		players: {},
		games: {},
		messages: []
	}

	await subscriptions.start(channel)
});

afterAll(async () => {
	await new Promise((resolve) => setTimeout(() => {
		console.log(`Unit test of channel ${channel} finished. Busy timeout ${BusyTimeout}`);
		resolve();
	}, 200));
	subscriptions.stop(channel);
	await subscriber.quit();
	await publisher.quit();
	output(reports, 'josh');
});

describe('Integration tests', () => {
	const commits: Record<string, Commit> = {};

	// it('register 2 players and open a game', async () => {
	// 	const c = await commands.RegisterPlayer({ playerName: 'paul' });
	// 	commits[c.id] = c;
	// 	const d = await commands.RegisterPlayer({ playerName: 'jack' });
	// 	commits[d.id] = d;
	// 	const g = await commands.OpenGame({ playerToken: c.id, gameName: 'paul\'s game' });
	// 	console.log(`c: ${JSON.stringify(c,null,' ')}\nd: ${JSON.stringify(d,null,' ')}\ng: ${JSON.stringify(g,null,' ')}`);
	// });

	// it('read the snapshot of the 2 registered players', async () => {
	// 	const { players, games } = await snapshot.read();
	// 	console.log('p', players);
	// 	console.log('g', games);
	// });

	it('players register in game room', async () => {
		for (const playerName of playerNames) {
			await commands.RegisterPlayer({ playerName: playerName });
		}
		const { players, games } = await snapshot.read();
		reports.messages = await subscriptions.report(channel);
		reports.players = players;
		reports.games = games;
		expect(Object.values(players).map(p => p.name).sort()).toEqual(playerNames.sort());
	});

	it('players leave game room', async () => {
		for (const player of Object.values(reports.players).filter(p => p.name === 'dave' || p.name === 'bill')) {
			await commands.PlayerLeave({ playerToken: player.token });
		}
		const { players, games } = await snapshot.read();
		reports.messages = await subscriptions.report(channel);
		reports.players = players;
		reports.games = games;
		expect(Object.values(reports.players).filter(p => p.status === 0).map(p => p.name).sort()).toEqual(['bill', 'dave']);
	});

	it('add duplicated player name', async () => {
		await commands.RegisterPlayer({ playerName: 'josh' });
		const { players, games } = await snapshot.read();
		reports.messages = await subscriptions.report(channel);
		reports.players = players;
		reports.games = games;
		expect(reports.messages.filter(m => m.message === 'Player josh already registered').length).toEqual(1);
	});

	it('non-existing player leave', async () => {
		await commands.PlayerLeave({ playerToken: '1234567890' });
		const { players, games } = await snapshot.read();
		reports.messages = await subscriptions.report(channel);
		reports.players = players;
		reports.games = games;
		expect(reports.messages.filter(m => m.message === 'Player 1234567890 not found').length).toEqual(1);
	});

	it('players open games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			const playerToken = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
			const gameName = `${hostName}'s game`;
			await commands.OpenGame({ playerToken, gameName });
		}
		const { players, games } = await snapshot.read();
		reports.messages = await subscriptions.report(channel);
		reports.players = players;
		reports.games = games;
		expect(Object.values(reports.games).map(g => g.name).sort()).toEqual(Object.keys(gameHosts).map(n => `${n}'s game`).sort());
	});
});
