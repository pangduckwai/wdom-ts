require('dotenv').config();
jest.mock('../rules/card');
jest.mock('../rules/rules');
jest.mock('../commands/index');
import RedisClient, { Redis } from 'ioredis';
// import { fromEventPattern, Observable, Subscription } from 'rxjs';
// import { debounceTime, filter } from 'rxjs/operators';
import { BusyTimeout, Commands, Commit, getCommands, getCommitStore, toCommits } from '../commands';
import { getSnapshot, getSubscriptions, Message, Snapshot, Subscriptions } from '../queries';
import { buildDeck, buildMap, buildWorld, Card, Game, Player, rules, _shuffle, shuffle, Territories, WildCards, RuleTypes } from '../rules';
import { CHANNEL, deserialize, isEmpty } from '..';

const output = (
	reports: {
		players: Record<string, Player>;
		games: Record<string, Game>;
		messages: Message[];
	},
	hostName: string
) => {
		const x = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
		const y = Object.values(reports.games).filter(g => g.host === x)[0].token;
		const g = reports.games[y];
		const output = 
	`>>> "${g.name}" [status: ${g.status}] [round: ${g.round}] [turn: ${g.turns}] [redeemed: ${g.redeemed}] ${(g.lastBattle ? `[red: ${g.lastBattle.redDice}; white: ${g.lastBattle.whiteDice}]` : '')}
	Card deck: ${g.cards.map(c => c.name)}
	Members:${g.players.map(k => {
		const p = reports.players[k];
		return `\n  ${k === x ? '*' : '-' } "${p.name}" [status: ${p.status}] [reinforcement: ${p.reinforcement}] [joined: "${(p.joined ? reports.games[p.joined].name : '')}"] [selected: ${reports.players[k].selected}]
	....holdings:${p.holdings.map(t => ` ${g.map[t].name}[${g.map[t].troop}]`)}
	....cards   :${Object.values(p.cards).map(c => ` ${c.name}(${c.type})`)}`;
	})}`;
		console.log(output.replace(/[.][.][.][.]/gi, '  '));

		const room = `Game room:${Object.values(reports.players).map(p => {
			return `\n "${p.name}" [token: ${p.token}] [status: ${p.status}] [reinforcement: ${p.reinforcement}] [joined: "${(p.joined ? reports.games[p.joined].name : '')}"]`;
		})}`;
		console.log(room);

		let message = '';
		// for (let i = ((reports.messages.length - 5) > 0 ? reports.messages.length - 5 : 0); i < reports.messages.length; i ++) {
		// 	message += `${reports.messages[i].commitId} ${reports.messages[i].type} ${reports.messages[i].eventName} ${reports.messages[i].message}\n`;
		// }
		for (let i = 0; i < reports.messages.length; i ++) {
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
	commands = getCommands(channel, publisher, map, deck);
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

describe('Integration tests - Game Room - Traditional initial territory claiming rule', () => {
	it('players register in game room', async () => {
		for (const playerName of playerNames) {
			await commands.RegisterPlayer({ playerName: playerName });
		}
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(Object.values(players).map(p => p.name).sort()).toEqual(playerNames.sort());
	});

	it('players leave game room', async () => {
		for (const player of Object.values(reports.players).filter(p => p.name === 'dave' || p.name === 'bill')) {
			await commands.PlayerLeave({ playerToken: player.token });
		}
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(Object.values(reports.players).filter(p => p.name === 'bill' || p.name === 'dave').length).toEqual(0);
	});

	it('add duplicated player name', async () => {
		await commands.RegisterPlayer({ playerName: 'josh' });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'Player "josh" already registered').length).toEqual(1);
	});

	it('non-existing player leave', async () => {
		await commands.PlayerLeave({ playerToken: '1234567890' });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'Player "1234567890" not found').length).toEqual(1);
	});

	it('players open games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			const playerToken = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
			const gameName = `${hostName}'s game`;
			await commands.OpenGame({ playerToken, gameName, ruleType: RuleTypes.SETUP_TRADITIONAL });
		}
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(Object.values(reports.games).map(g => g.name).sort()).toEqual(Object.keys(gameHosts).map(n => `${n}'s game`).sort());
	});

	it('players join games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			const hostToken = Object.values(reports.players).filter(p => p.name === hostName)[0].token;
			const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
			for (const playerName of gameHosts[hostName]) {
				const playerToken = Object.values(reports.players).filter(p => p.name === playerName)[0].token;
				await commands.JoinGame({ playerToken, gameToken });
			}
		}
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
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

	it('player join his/her own game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'pete')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === playerToken)[0].token;
		await commands.JoinGame({ playerToken, gameToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'You don\'t need to join your own game').length).toEqual(1);
	});

	it('player close game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'saul')[0].token;
		await commands.CloseGame({ playerToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(Object.values(reports.games).filter(g => g.name === 'saul\'s game').length).toEqual(0);
		expect(Object.values(reports.players)
			.filter(p => (p.name === 'saul') || (p.name === 'nick') || (p.name === 'mike') || (p.name === 'john'))
			.filter(p => !p.joined).length).toEqual(4);
	});

	it('non-host player try to close a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'matt')[0].token;
		await commands.CloseGame({ playerToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'Player "matt" is not the host of game "josh\'s game"').length).toEqual(1);
	});

	it('players join another game', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const names = [...gameHosts['saul'], 'saul'];
		for (const playerName of names) {
			const playerToken = Object.values(reports.players).filter(p => p.name === playerName)[0].token;
			await commands.JoinGame({ playerToken, gameToken });
		}
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
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
		await expect(commands.StartGame({ playerToken, gameToken })).rejects.toThrow('Not enough players in the game "pete\'s game" yet');
	});

	it('player quit a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'jess')[0].token;
		await commands.QuitGame({ playerToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].joined).toBeUndefined();
	});

	it('player try to quit his own game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'pete')[0].token;
		await commands.QuitGame({ playerToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'You cannot quit from the game you are hosting').length).toEqual(1);
	});

	it('player not in a game try to quit game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'dick')[0].token;
		await commands.QuitGame({ playerToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'You are not in any game currently').length).toEqual(1);
	});

	it('non-host player try to start a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'matt')[0].token;
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		await expect(commands.StartGame({ playerToken, gameToken })).rejects.toThrow('Player "matt" is not the host of game "josh\'s game"');
	});

	it('player try to join a full game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'jess')[0].token;
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		await commands.JoinGame({ playerToken, gameToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === 'Game "josh\'s game" already full').length).toEqual(1);
	});

	it('player start a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === playerToken)[0].token;
		await commands.StartGame({ playerToken, gameToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };

		const cards = reports.games[gameToken].cards.map(c => c.name);
		expect(cards.length).toEqual(44);
		expect(cards[36]).toEqual('Wildcard-2');

		const holdings = reports.players[playerToken].holdings;
		expect(holdings.length).toEqual(0);
		expect(reports.games[gameToken].status).toEqual(2);
		expect(reports.players[playerToken].reinforcement).toEqual(rules.initialTroops(6) - reports.players[playerToken].holdings.length);
	});
});

const script: Record<string, string[]> = {
	'matt': ['Western-Australia', 'Eastern-Australia', 'New-Guinea', 'China', 'Manchuria', 'Japan', 'Kamchatka'],
	'josh': ['Peru', 'Argentina', 'Brazil', 'Western-United-States', 'Alberta', 'Northwest-Territory', 'Alaska'],
	'john': ['Congo', 'South-Africa', 'Madagascar', 'Southern-Europe', 'Ukraine', 'Scandinavia', 'Iceland'],
	'mike': ['East-Africa', 'North-Africa', 'Egypt', 'Western-Europe', 'Northern-Europe', 'Great-Britain', 'Irkutsk'],
	'nick': ['Venezuela', 'Mexico', 'Eastern-United-States', 'Ontario', 'Quebec', 'Greenland', 'Siberia'],
	'saul': ['Indonesia', 'Siam', 'Middle-East', 'India', 'Afghanistan', 'Ural', 'Yakutsk']
};

describe('Integration tests - Game Play - Traditional initial territory claiming rule', () => {
	let hostToken: string;
	let gameToken: string;

	beforeAll(async () => {
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
	});

	it('player not in turn try to place troop during game setup phase', async () => {
		await expect(commands.MakeMove({
			playerToken: hostToken,
			gameToken,
			territoryName: 'Indonesia',
			flag: 0
		})).rejects.toThrow('It is not the turn of player "josh"');
	});

	it('players claim territories', async () => {
		let count = 0;
		while (count < 6) {
			const turn = reports.games[gameToken].turns;
			const name = reports.players[reports.games[gameToken].players[turn]].name;
			await commands.MakeMove({
				playerToken: reports.games[gameToken].players[turn],
				gameToken,
				territoryName: script[name][reports.players[reports.games[gameToken].players[turn]].holdings.length],
				flag: 0
			});
			const { players, games } = await snapshot.read();
			reports.players = players;
			reports.games = games;
			count ++;
		}
		reports.messages = await subscriptions.report(channel);
		expect(reports.games[gameToken].turns).toEqual(0);
	});

	it('try to reinforce a territory before all territories are claimed', async () => {
		const turn = reports.games[gameToken].turns;
		await expect(commands.MakeMove({
			playerToken: reports.games[gameToken].players[turn],
			gameToken,
			territoryName: 'Western-Australia',
			flag: 0
		})).rejects.toThrow('please claim all territories first');
	});

	it('players continue to claim territories', async () => {
		let count = 0;
		while (count < 36) {
			const turn = reports.games[gameToken].turns;
			const name = reports.players[reports.games[gameToken].players[turn]].name;
			await commands.MakeMove({
				playerToken: reports.games[gameToken].players[turn],
				gameToken,
				territoryName: script[name][reports.players[reports.games[gameToken].players[turn]].holdings.length],
				flag: 0
			});
			const { players, games } = await snapshot.read();
			reports.players = players;
			reports.games = games;
			count ++;
		}
		reports.messages = await subscriptions.report(channel);
		expect(reports.games[gameToken].players.filter(p => reports.players[p].holdings.length === 7).length).toEqual(6);
	});

	it('players reinforce their positions', async () => {
		let count = 0;
		while (count < 10) {
			const turn = reports.games[gameToken].turns;
			const name = reports.players[reports.games[gameToken].players[turn]].name;
			await commands.MakeMove({
				playerToken: reports.games[gameToken].players[turn],
				gameToken,
				territoryName: script[name][0],
				flag: 0
			});
			const { players, games } = await snapshot.read();
			reports.players = players;
			reports.games = games;
			count ++;
		}
		reports.messages = await subscriptions.report(channel);
		expect(reports.games[gameToken].turns).toEqual(4);
	});

	it('a player place all remaining troops at once', async () => {
		const turn = reports.games[gameToken].turns;
		const name = reports.players[reports.games[gameToken].players[turn]].name;
		await commands.MakeMove({
			playerToken: reports.games[gameToken].players[turn],
			gameToken,
			territoryName: script[name][0],
			flag: 2
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.games[gameToken].turns).toEqual(5);
	});

	it('remaining players continue to reinforce their positions', async () => {
		let count = 0;
		while (count < 26) {
			const turn = reports.games[gameToken].turns;
			const name = reports.players[reports.games[gameToken].players[turn]].name;
			await commands.MakeMove({
				playerToken: reports.games[gameToken].players[turn],
				gameToken,
				territoryName: script[name][0],
				flag: 0
			});
			const { players, games } = await snapshot.read();
			reports.players = players;
			reports.games = games;
			count ++;
		}
		reports.messages = await subscriptions.report(channel);
		expect(reports.games[gameToken].turns).toEqual(0);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	it('1st player play out the 1st turn', async () => {
		const targets = ['Western-Australia', 'Indonesia', 'Indonesia', 'Indonesia', 'Indonesia', 'Indonesia', 'Indonesia', 'Indonesia', 'Indonesia', 'Siam'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'Indonesia', amount: 2
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Indonesia');
		expect(reports.games[gameToken].map['Indonesia'].troop).toEqual(3);
	});

	it('2nd player play out the 1st turn', async () => {
		const targets = ['Peru', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.EndTurn({
			playerToken, gameToken
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Venezuela');
		expect(reports.games[gameToken].map['Venezuela'].troop).toEqual(4);
	});

	it('3rd player play out the 1st turn', async () => {
		const targets = ['Congo', 'North-Africa', 'Brazil'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'North-Africa', amount: 8
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('North-Africa');
		expect(reports.games[gameToken].map['North-Africa'].troop).toEqual(9);
	});

	it('4th player play out the 1st turn', async () => {
		const targets = ['East-Africa', 'South-Africa'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'East-Africa', amount: 9
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('East-Africa');
		expect(reports.games[gameToken].map['East-Africa'].troop).toEqual(10);
	});

	it('5th player play out the 1st turn', async () => {
		const targets = ['Mexico', 'Venezuela', 'Venezuela', 'Venezuela'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.EndTurn({
			playerToken, gameToken
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Mexico');
		expect(reports.games[gameToken].map['Mexico'].troop).toEqual(1);
	});

	it('6th player play out the 1st turn', async () => {
		const targets = ['India', 'Siam', 'Indonesia', 'Indonesia'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.EndTurn({
			playerToken, gameToken
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Siam');
		expect(reports.games[gameToken].map['Siam'].troop).toEqual(1);
	});

	it('1st player play out the 2nd turn', async () => {
		const targets = ['Indonesia', 'Indonesia', 'China', 'China', 'China', 'Siam'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 0
			});
		}
		await commands.EndTurn({
			playerToken, gameToken
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Siam');
		expect(reports.games[gameToken].map['Siam'].troop).toEqual(3);
	});

	it('2nd player play out the 2nd turn', async () => {
		const targets = ['Peru', 'Brazil'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.EndTurn({
			playerToken, gameToken
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Brazil');
		expect(reports.games[gameToken].map['Brazil'].troop).toEqual(3);
	});

	it('3rd player play out the 2nd turn', async () => {
		const targets = ['North-Africa', 'Brazil', 'Brazil', 'Argentina', 'Peru', 'Venezuela'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'Brazil', amount: 4
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Brazil');
		expect(reports.games[gameToken].map['Brazil'].troop).toEqual(5);
	});

	it('4th player play out the 2nd turn', async () => {
		const targets = ['East-Africa', 'Middle-East', 'India', 'Afghanistan', 'Ural', 'Siberia', 'Yakutsk'];
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: 2
			});
		}
		// await commands.FortifyPosition({
		// 	playerToken, gameToken, territoryName: 'East-Africa', amount: 9
		// });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		// expect(reports.players[playerToken].selected).toEqual('East-Africa');
		// expect(reports.games[gameToken].map['East-Africa'].troop).toEqual(10);
	});

});