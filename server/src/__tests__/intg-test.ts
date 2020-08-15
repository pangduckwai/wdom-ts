require('dotenv').config();
jest.mock('../rules/card');
jest.mock('../rules/rules');
jest.mock('../commands/index');
import RedisClient, { Redis } from 'ioredis';
// import { fromEventPattern, Observable, Subscription } from 'rxjs';
// import { debounceTime, filter } from 'rxjs/operators';
import { Commands, Commit, CommitStore, toCommits } from '../commands';
import { Game, Message, Player, Subscriptions } from '../queries';
import { buildDeck, buildMap, buildWorld, Card, rules, _shuffle, shuffle, Territories, WildCards } from '../rules';
import { CHANNEL, deserialize, isEmpty } from '..';

const output = (
	reports: {
		ready: boolean;
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
let commitStore: {
	put: (channel: string, commit: Commit) => Promise<Commit>,
	get: (channel: string, args?: { id?: string; from?: string; to?: string}) => Promise<Commit[]>
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
	subscriptions = Subscriptions(publisher, world, map, deck);

	await subscriptions.start(channel)
});

afterAll(async () => {
	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	subscriptions.stop(channel);
	await subscriber.quit();
	await publisher.quit();
	output(reports, 'josh');
});

describe('Integration tests', () => {
	it('players register in game room', async () => {
		for (const playerName of playerNames) {
			await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.players).map(p => p.name).sort()).toEqual(playerNames.sort());
	});
});