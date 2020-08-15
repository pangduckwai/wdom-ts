require('dotenv').config();
jest.mock('../rules/card');
jest.mock('../rules/rules');
import RedisClient, { Redis } from 'ioredis';
import { fromEventPattern, Observable, Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
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

// describe('Registering player tests', () => {
// 	const channel = `${CHANNEL}CMT`;
// 	const mockInSubscriber = jest.fn();
// 	const players: Record<string, Commit> = {};
// 	const games: Record<string, Commit> = {};
// 	let subscribed: Commit[] = [];
// 	let publisher: Redis;
// 	let subscriber: Redis;
// 	let commitStore: {
// 		put: (channel: string, commit: Commit) => Promise<Commit>,
// 		get: (channel: string, args?: { id?: string; fromTime?: number; toTime?: number}) => Promise<{
// 			index: number;
// 			commit: Commit;
// 		}[]>
// 	};

// 	beforeAll(async () => {
// 		publisher = new RedisClient({ host, port });
// 		subscriber = new RedisClient({ host, port });
// 		subscriber.on('message', (channel, message) => {
// 			// console.log(`Subscribed: ${channel} - ${message}`);
// 			mockInSubscriber(channel, message);
// 		});

// 		mockInSubscriber.mockImplementation((channel, message) => {
// 			subscribed.push(JSON.parse(message));
// 		});

// 		await subscriber.subscribe(channel);
// 		commitStore = CommitStore(publisher);
// 	});

// 	afterAll(async () => {
// 		await subscriber.quit();
// 		await publisher.quit();
// 	});

// 	it('subscription preserve commits order', async () => {
// 		for (const playerName of playerNames) {
// 			const commit = await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
// 			if (commit) players[playerName] = commit;
// 		}
// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));

// 		const result: string[] = [];
// 		for (const msg of subscribed) {
// 			for (const evt of msg.events) {
// 				result.push(evt.payload.playerName);
// 			}
// 		}
// 		expect(result).toEqual(Object.keys(players));
// 	});

// 	it('subscription match inputs', async () => {
// 		const compare: Record<string, Commit> = {};
// 		for (const result of subscribed) {
// 			for (const evt of result.events) {
// 				compare[evt.payload.playerName] = result;
// 			}
// 		}
// 		expect(compare).toEqual(players);
// 	});

// 	it('get commit by id match inputs', async () => {
// 		const commit = await commitStore.get(channel, { id: players['josh'].id });
// 		expect(commit.length).toEqual(1);
// 		expect(commit[0].commit).toEqual(players['josh']);
// 	});

// 	it('subscription match reading from redis directly', async () => {
// 		const results = await commitStore.get(channel);
// 		expect(results.map(r => r.commit)).toEqual(subscribed);
// 	});

// 	it('reading from redis directly match inputs', async () => {
// 		const results = await commitStore.get(channel);
// 		const compare: Record<string, Commit> = {};
// 		for (const result of results) {
// 			for (const evt of result.commit.events) {
// 				compare[evt.payload.playerName] = result.commit;
// 			}
// 		}
// 		expect(compare).toEqual(players);
// 	});

// 	it('player leave game', async () => {
// 		subscribed = [];
// 		for (const playerName of ['bill', 'dave']) {
// 			const commit = await commitStore.put(channel, Commands.PlayerLeave({ playerToken: players[playerName].id }));
// 			// if (commit) delete players[playerName];
// 		}
// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));

// 		const result: string[] = [];
// 		for (const msg of subscribed) {
// 			for (const evt of msg.events) {
// 				result.push(evt.payload.playerToken);
// 			}
// 		}
// 		expect(result).toEqual([players['bill'].id, players['dave'].id]);
// 	});

// 	it('players open games', async () => {
// 		subscribed = [];
// 		for (const hostName of Object.keys(gameHosts)) {
// 			const playerToken = players[hostName].id;
// 			const gameName = `${hostName}'s game`;
// 			const commit = await commitStore.put(channel, Commands.OpenGame({ playerToken, gameName }));
// 			if (commit) games[hostName] = commit;
// 		}
// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));

// 		const result: string[] = [];
// 		for (const msg of subscribed) {
// 			for (const evt of msg.events) {
// 				result.push(evt.payload.gameName);
// 			}
// 		}
// 		expect(result).toEqual(Object.values(games).map(g => g.events[0].payload.gameName));
// 	});

// 	it('players join games', async () => {
// 		subscribed = [];
// 		for (const hostName of Object.keys(gameHosts)) {
// 			for (const playerName of gameHosts[hostName]) {
// 				const playerToken = players[playerName].id;
// 				const gameToken = games[hostName].id;
// 				const commit = await commitStore.put(channel, Commands.JoinGame({ playerToken, gameToken }));
// 			}
// 		}
// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));

// 		const result: string[] = [];
// 		for (const msg of subscribed) {
// 			for (const evt of msg.events) {
// 				result.push(Object.values(players).filter(p => p.id === msg.events[0].payload.playerToken)[0].events[0].payload.playerName);
// 			}
// 		}
// 		const expected: string[] = [];
// 		for (const gh of Object.values(gameHosts)) {
// 			expected.push(...gh);
// 		}
// 		expect(expected).toEqual(result);
// 	});

// 	it('player start game', async () => {
// 		subscribed = [];
// 		const playerToken = players['saul'].id;
// 		const gameToken = games['saul'].id;
// 		const commit = await commitStore.put(channel, Commands.StartGame({ playerToken, gameToken }));
// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));

// 		// console.log(JSON.stringify(subscribed, null, ' '));
// 	});
// });

// describe('rxjs tests', () => {
// 	const channel = `${CHANNEL}Rx`;
// 	const players: Record<string, Commit> = {};
// 	let received: Notification[] = [];
// 	let publisher: Redis;
// 	let subscriber: Redis;
// 	let commitStore: {
// 		put: (channel: string, commit: Commit) => Promise<Commit>,
// 		pub: (channel: string, commit: Commit) => Promise<Commit>,
// 		get: (channel: string, args?: { id?: string; fromTime?: number; toTime?: number}) => Promise<{
// 			index: number;
// 			commit: Commit;
// 		}[]>
// 	};
// 	let source$: Observable<any>;
// 	let subscribe$: Subscription;

// 	beforeAll(async () => {
// 		publisher = new RedisClient({ host, port });
// 		subscriber = new RedisClient({ host, port });
// 		commitStore = CommitStore(publisher);

// 		source$ = fromEventPattern(
// 			handler => {
// 				subscriber.on('message', (channel: string, message: string) => {
// 					handler({ channel, message });
// 				});
// 				subscriber.subscribe(channel)
// 					.then(x => console.log('Redis subscribed', x))
// 					.catch(e => console.log(e));
// 			},
// 			_ => {
// 				subscriber.unsubscribe(channel)
// 					.then(x => console.log('Redis unsubscribed', x))
// 					.catch(e => console.log(e));
// 			}
// 		);

// 		subscribe$ = source$
// 			.pipe(
// 				debounceTime(100)
// 			)
// 			.subscribe({
// 				next: event => {
// 					received.push(deserialize('Commit Test', event.message, isNotification));
// 					console.log(event);
// 				},
// 				error: error => console.log(error),
// 				complete: () => console.log('complete!')
// 			});
// 	});

// 	afterAll(async () => {
// 		await new Promise((resolve) => setTimeout(() => resolve(), 200));
// 		subscribe$.unsubscribe();
// 		await subscriber.quit();
// 		await publisher.quit();
// 	});

// 	it('test', async () => {
// 		for (const playerName of playerNames) {
// 			const commit = await commitStore.pub(channel, Commands.RegisterPlayer({ playerName: playerName }));
// 			if (commit) players[playerName] = commit;
// 		}
// 		await new Promise((resolve) => setTimeout(() => resolve(), 200));
// 		expect(received.length).toEqual(1);
// 	});

// 	it('player leave game', async () => {
// 		for (const playerName of ['bill', 'dave']) {
// 			const commit = await commitStore.pub(channel, Commands.PlayerLeave({ playerToken: players[playerName].id }));
// 		}
// 		await new Promise((resolve) => setTimeout(() => resolve(), 200));
// 		expect(received.length).toEqual(2);
// 	});
// });

describe('Subscriptions tests', () => {
	const channel = `${CHANNEL}Scb`;
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

	it('players register in game room', async () => {
		for (const playerName of playerNames) {
			await commitStore.put(channel, Commands.RegisterPlayer({ playerName: playerName }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.players).map(p => p.name).sort()).toEqual(playerNames.sort());
	});

	it('players leave game room', async () => {
		for (const player of Object.values(reports.players).filter(p => p.name === 'dave' || p.name === 'bill')) {
			await commitStore.put(channel, Commands.PlayerLeave({ playerToken: player.token }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.players).filter(p => p.status === 0).map(p => p.name).sort()).toEqual(['bill', 'dave']);
	});

	it('add duplicated player name', async () => {
		await commitStore.put(channel, Commands.RegisterPlayer({ playerName: 'josh' }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'Player josh already registered').length).toEqual(1);
	});

	it('non-existing player leave', async () => {
		await commitStore.put(channel, Commands.PlayerLeave({ playerToken: '1234567890' }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'Player 1234567890 not found').length).toEqual(1);
	});

	it('players open games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			const playerToken = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
			const gameName = `${hostName}'s game`;
			await commitStore.put(channel, Commands.OpenGame({ playerToken, gameName }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.games).map(g => g.name).sort()).toEqual(Object.keys(gameHosts).map(n => `${n}'s game`).sort());
	});

	it('players join games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			const hostToken = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
			const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
			for (const playerName of gameHosts[hostName]) {
				const playerToken = Object.values(reports.players).filter(p => p.name === playerName)[0].token;
				await commitStore.put(channel, Commands.JoinGame({ playerToken, gameToken }));
			}
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		for (const hostName of Object.keys(gameHosts)) {
			const hostToken = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
			expect(
				Object.values(reports.games)
					.filter(g => g.host === hostToken)[0]
					.players
					.filter(p => p !== hostToken)
					.map(p => reports.players[p].name)
					.sort())
				.toEqual(gameHosts[hostName].sort());
		}
	});

	it('player join his own game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'pete')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === playerToken)[0].token;
		await commitStore.put(channel, Commands.JoinGame({ playerToken, gameToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'Cannot join your own game').length).toEqual(1);
	});

	it('player close game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'saul')[0].token;
		await commitStore.put(channel, Commands.CloseGame({ playerToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(Object.values(reports.games).filter(g => g.status === 0).map(g => g.name)).toEqual(['saul\'s game']);
		expect(Object.values(reports.players)
			.filter(p => (p.name === 'saul') || (p.name === 'nick') || (p.name === 'mike') || (p.name === 'john'))
			.filter(p => !p.joined).length).toEqual(4);
	});

	it('non-host player try to close a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'matt')[0].token;
		await commitStore.put(channel, Commands.CloseGame({ playerToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'Player matt is not hosting any game').length).toEqual(1);
	});

	it('players join another game', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const names = [...gameHosts['saul'], 'saul'];
		for (const playerName of names) {
			const playerToken = Object.values(reports.players).filter(p => p.name === playerName)[0].token;
			await commitStore.put(channel, Commands.JoinGame({ playerToken, gameToken }));
		}
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(
			Object.values(reports.games)
				.filter(g => g.host === hostToken)[0]
				.players
				.map(p => reports.players[p].name)
				.sort())
			.toEqual([...names, 'matt', 'josh'].sort());
	});

	it('try to start a game with too few players', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'pete')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === playerToken)[0].token;
		await commitStore.put(channel, Commands.StartGame({ playerToken, gameToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'Not enough players in the game pete\'s game yet').length).toEqual(1);
	});

	it('player quit a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'jess')[0].token;
		await commitStore.put(channel, Commands.QuitGame({ playerToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.players[playerToken].joined).toBeUndefined();
	});

	it('player try to quit his own game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'pete')[0].token;
		await commitStore.put(channel, Commands.QuitGame({ playerToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'You cannot quit your own game').length).toEqual(1);
	});

	it('player not in a game try to quit game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'dick')[0].token;
		await commitStore.put(channel, Commands.QuitGame({ playerToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'You are not in any game currently').length).toEqual(1);
	});

	it('non-host player try to start a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'matt')[0].token;
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		await commitStore.put(channel, Commands.StartGame({ playerToken, gameToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'You can only start your own game').length).toEqual(1);
	});

	it('player try to join a full game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'jess')[0].token;
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		await commitStore.put(channel, Commands.JoinGame({ playerToken, gameToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);
		expect(reports.messages.filter(m => m.message === 'Game josh\'s game already full').length).toEqual(1);
	});

	it('player start a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === playerToken)[0].token;
		await commitStore.put(channel, Commands.StartGame({ playerToken, gameToken }));
		await new Promise((resolve) => setTimeout(() => resolve(), 200));
		reports = await subscriptions.report(channel);

		const cards = reports.games[gameToken].cards.map(c => c.name);
		expect(cards.length).toEqual(44);
		expect(cards[42]).toEqual('Wildcard-2');

		const holdings = reports.players[playerToken].holdings;
		expect(Object.keys(holdings).length).toEqual(7);
		expect(Object.values(holdings).map(t => t.name)[3]).toEqual('Great-Britain');
		expect(reports.games[gameToken].status).toEqual(2);
		expect(reports.players[playerToken].reinforcement).toEqual(rules.initialTroops(6) - Object.keys(reports.players[playerToken].holdings).length);
	});

	// it('player other than the one currently in turn try to make a move', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === playerToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Eastern-Australia', flag: 0 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.messages.filter(m => m.message === 'This is not yet your turn').length).toEqual(1);
	// });

	// it('player made a move', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'nick')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'South-Africa', flag: 0 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.players[playerToken].holdings['South-Africa'].troop).toEqual(2);
	// });

	// it('2nd player made a move', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'mike')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Argentina', flag: 0 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.players[playerToken].holdings['Argentina'].troop).toEqual(2);
	// });

	// it('other players make moves', async () => {
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	while (
	// 		reports.games[gameToken].round < 1 &&
	// 		reports.games[gameToken].players.filter(k => reports.players[k].reinforcement > 0).length > 0
	// 	) {
	// 		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
	// 		let territoryName;
	// 		switch (reports.games[gameToken].turns) {
	// 			case 0:
	// 				territoryName = 'South-Africa';
	// 				break;
	// 			case 1:
	// 				territoryName = 'Argentina';
	// 				break;
	// 			case 2:
	// 				territoryName = 'Egypt';
	// 				break;
	// 			case 3:
	// 				territoryName = 'Madagascar';
	// 				break;
	// 			case 4:
	// 				territoryName = 'Brazil';
	// 				break;
	// 			case 5:
	// 				territoryName = 'Venezuela';
	// 				break;
	// 			default:
	// 				territoryName = 'XXX';
	// 				break;
	// 		}
	// 		await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName, flag: 0 }));
	// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));
	// 		reports = await subscriptions.report(channel);
	// 		await new Promise((resolve) => setTimeout(() => resolve(), 100));
	// 	}
	// 	expect(reports.players[reports.games[gameToken].players[0]].reinforcement === 3);
	// });

	// it('player starting a turn', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'nick')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'South-Africa', flag: 1 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.players[playerToken].holdings['South-Africa'].troop).toEqual(9);
	// });

	// // North-Africa
	// it('player attack a non-adjacent territory owned by another player', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'nick')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Egypt', flag: 1 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.messages.filter(m => m.message === 'Territories not connected').length).toEqual(1);
	// });

	// it('player attack a territory', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'nick')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Congo', flag: 1 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.players[playerToken].holdings['Congo']).toBeDefined();
	// });

	// it('player fortified a territory', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'nick')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.Fortify({ playerToken, gameToken, territoryName: 'North-Africa', amount: 7 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.games[gameToken].turns).toEqual(1);
	// });

	// it('Next player makes moves', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'mike')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Argentina', flag: 1 }));
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Brazil', flag: 0 }));
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Brazil', flag: 0 }));
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Brazil', flag: 0 }));
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Brazil', flag: 0 }));
	// 	await commitStore.put(channel, Commands.MakeMove({ playerToken, gameToken, territoryName: 'Brazil', flag: 0 }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// });

	// it('player end a turn', async () => {
	// 	const playerToken = Object.values(reports.players).filter(p => p.name === 'mike')[0].token;
	// 	const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
	// 	const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	// 	await commitStore.put(channel, Commands.EndTurn({ playerToken, gameToken }));
	// 	await new Promise((resolve) => setTimeout(() => resolve(), 200));
	// 	reports = await subscriptions.report(channel);
	// 	expect(reports.games[gameToken].turns).toEqual(2);
	// })
});
