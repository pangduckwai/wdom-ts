require('dotenv').config();
jest.mock('../rules/card');
jest.mock('../rules/rules');
import RedisClient, { Redis } from 'ioredis';
import { Commands, getCommands } from '../commands';
import { getSnapshot, getSubscriptions, Message, Snapshot, Subscriptions } from '../queries';
import { buildDeck, buildMap, buildWorld, Game, Player, rules, _shuffle, Territories, RuleTypes } from '../rules';
import { CHANNEL } from '..';

const statusName = ['Deleted ', 'New     ', 'Ready   ', 'Defeated', 'Finished'];
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
`>>> "${g.name}" [status: ${statusName[g.status].trim()}] [round: ${g.round}] [turn: ${g.turns}] [redeemed: ${g.redeemed}] ${(g.lastBattle ? `[red: ${g.lastBattle.redDice}; white: ${g.lastBattle.whiteDice}]` : '')}
Card deck: ${g.cards.map(c => ` ${c.name}(${['W','A','C','I'][c.type]})`)}
Members:${g.players.map(k => {
	const p = reports.players[k];
	return `\n  ${k === x ? '*' : '-' } "${p.name}" [status: ${statusName[p.status].trim()}] [reinforcement: ${p.reinforcement}] [joined: "${(p.joined ? reports.games[p.joined].name : '')}"] [selected: ${reports.players[k].selected}]
....holdings:${p.holdings.map(t => ` ${g.map[t].name}[${g.map[t].troop}]`)}
....cards   :${Object.values(p.cards).map(c => ` ${c.name}(${['W','A','C','I'][c.type]})`)}`;
})}`;
	console.log(output.replace(/[.][.][.][.]/gi, '    '));

	const room = `Game room:${Object.values(reports.players).map(p => {
		return `\n "${p.name}" [token: ${p.token}] [status: ${statusName[p.status]}] [reinforcement: ${p.reinforcement}] [joined: "${(p.joined ? reports.games[p.joined].name : '')}"]`;
	})}`;
	console.log(room);

	let message = '';
	for (let i = 0; i < reports.messages.length; i ++) {
		message += `${reports.messages[i].commitId} ${reports.messages[i].type} ${reports.messages[i].eventName} ${reports.messages[i].message}\n`;
	}
	if (reports.messages.length > 0) console.log(message);
};
	
const host = process.env.REDIS_HOST;
const port = (process.env.REDIS_PORT || 6379) as number;
const world = buildWorld();
const map = buildMap();
const deck = buildDeck();

const playerNames = ['pete', 'josh', 'saul', 'jess', 'bill', 'matt', 'nick', 'dick', 'dave', 'john', 'mike'];
const gameHosts: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'], // 'nick', 'mike', 'john', 'saul'
	'saul': ['nick', 'mike', 'john']
};
const initLocation = (index: number, round: number = 0): Territories => {
	switch (index) {
		case 0: return 'Eastern-Australia';
		case 1: return 'Indonesia';
		case 2: return 'Argentina';
		case 3: return 'Egypt';
		case 4: return 'Quebec';
		case 5: return (round < 19) ? 'Venezuela' : 'Ontario';
		default: return 'China';
	}
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
		console.log(`Unit test of channel ${channel} finished`);
		resolve();
	}, 200));
	subscriptions.stop(channel);
	await subscriber.quit();
	await publisher.quit();
	output(reports, 'josh');
});

describe('Integration tests - Use random initial territory assignment rule', () => {
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
		expect(reports.messages.filter(m => m.message === '[josh] already registered').length).toEqual(1);
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
			await commands.OpenGame({ playerToken, gameName, ruleType: RuleTypes.SETUP_RANDOM });
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
		expect(reports.messages.filter(m => m.message === '[pete] cannot join your own game').length).toEqual(1);
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
		expect(reports.messages.filter(m => m.message === '[matt] is not the host of game "josh\'s game"').length).toEqual(1);
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
		expect(reports.messages.filter(m => m.message === '[pete] cannot quit from the game you are hosting').length).toEqual(1);
	});

	it('player not in a game try to quit game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'dick')[0].token;
		await commands.QuitGame({ playerToken });
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.messages.filter(m => m.message === '[dick] is not in any game currently').length).toEqual(1);
	});

	it('non-host player try to start a game', async () => {
		const playerToken = Object.values(reports.players).filter(p => p.name === 'matt')[0].token;
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		await expect(commands.StartGame({ playerToken, gameToken })).rejects.toThrow('[matt] is not the host of game "josh\'s game"');
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
		expect(holdings.length).toEqual(7);
		expect(holdings[5]).toEqual('Eastern-United-States');
		expect(reports.games[gameToken].status).toEqual(2);
		expect(reports.players[playerToken].reinforcement).toEqual(rules.initialTroops(6) - reports.players[playerToken].holdings.length);
	});

	it('player not in turn try to place troop during game setup phase', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		await expect(commands.MakeMove({
			playerToken: hostToken,
			gameToken,
			territoryName: 'Indonesia',
			flag: 0
		})).rejects.toThrow('It is not the turn of player "josh"');
	});

	it('players place troops', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		let index = reports.games[gameToken].turns;
		for (let i = 0; i < 10; i ++) {
			const territoryName = initLocation(index);
			await commands.MakeMove({
				playerToken: reports.games[gameToken].players[index],
				gameToken,
				territoryName,
				flag: 0
			});

			index ++;
			if (index >= reports.games[gameToken].players.length) index = 0;
		}
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.games[gameToken].turns).toEqual(4);
	});

	it('a player place all remaining troops at once', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		let index = reports.games[gameToken].turns;
		const playerToken = reports.games[gameToken].players[index];
		await commands.MakeMove({
			playerToken,
			gameToken,
			territoryName: 'Quebec',
			flag: 2
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].reinforcement).toEqual(0);
	});

	it('other players continue to place troops one at a time', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		for (let i = 0; i < 26; i ++) {
			const index = reports.games[gameToken].turns;
			const territoryName = initLocation(index, i);
			await commands.MakeMove({
				playerToken: reports.games[gameToken].players[index],
				gameToken,
				territoryName,
				flag: 0
			});
			const { players, games } = await snapshot.read();
			reports.players = players;
			reports.games = games;
		}
		reports.messages = await subscriptions.report(channel);
		expect(reports.games[gameToken].round).toEqual(1);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	it('player prepare to start turn', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		while (reports.players[playerToken].reinforcement > 0) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: initLocation(reports.games[gameToken].turns), flag: 0
			});
			const { players, games } = await snapshot.read();
			reports.players = players;
			reports.games = games;
		}
		reports.messages = await subscriptions.report(channel);
		expect(reports.games[gameToken].map[initLocation(reports.games[gameToken].turns)].troop).toEqual(11);
		expect(reports.players[playerToken].reinforcement).toEqual(0);
	});

	it('first player play out his turn', async () => {
		const targets = ['Western-Australia', 'New-Guinea', 'Indonesia', 'Indonesia'];
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
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
		expect(reports.players[playerToken].selected).toEqual('New-Guinea');
		expect(reports.games[gameToken].map['New-Guinea'].troop).toEqual(7);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	it('second player try to attack before finish turn setup', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		await expect(commands.MakeMove({
			playerToken, gameToken, territoryName: 'Siam', flag: 0
		})).rejects.toThrow('[commands.MakeMove] [josh] please deploy all reinforcement before continuing');
	});

	it('second player play out his turn', async () => {
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		await commands.MakeMove({
			playerToken, gameToken, territoryName: 'Indonesia', flag: 2
		});
		await commands.MakeMove({
			playerToken, gameToken, territoryName: 'Siam', flag: 0
		});
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'China', amount: 7
		})
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('China');
		expect(reports.games[gameToken].map['China'].troop).toEqual(8);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	it('third player play out his turn', async () => {
		const targets = ['Argentina', 'Peru', 'Brazil', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela', 'Venezuela'];
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: (target === 'Argentina') ? 2 : 0
			});
		}
		await commands.EndTurn({
			playerToken, gameToken
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Venezuela');
		expect(reports.games[gameToken].map['Venezuela'].troop).toEqual(4);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	it('forth player play out his turn', async () => {
		const targets = ['Egypt', 'North-Africa', 'Congo', 'South-Africa', 'Madagascar', 'East-Africa'];
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: (target === 'Egypt') ? 2 : 0
			});
		}
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'Egypt', amount: 5
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Egypt');
		expect(reports.games[gameToken].map['Egypt'].troop).toEqual(6);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	it('fifth player play out his turn', async () => {
		const targets = ['Quebec', 'Ontario', 'Ontario', 'Ontario', 'Greenland', 'Iceland'];
		const hostToken = Object.values(reports.players).filter(p => p.name === 'josh')[0].token;
		const gameToken = Object.values(reports.games).filter(g => g.host === hostToken)[0].token;
		const playerToken = reports.games[gameToken].players[reports.games[gameToken].turns];
		for (const target of targets) {
			await commands.MakeMove({
				playerToken, gameToken, territoryName: target, flag: (target === 'Quebec') ? 2 : 0
			});
		}
		await commands.FortifyPosition({
			playerToken, gameToken, territoryName: 'Great-Britain', amount: 5
		});
		const { players, games } = await snapshot.read();
		reports = { players, games, messages: await subscriptions.report(channel) };
		expect(reports.players[playerToken].selected).toEqual('Great-Britain');
		expect(reports.games[gameToken].map['Great-Britain'].troop).toEqual(6);
		expect(reports.players[reports.games[gameToken].players[reports.games[gameToken].turns]].reinforcement).toEqual(3);
	});

	// it('last player play out his turn', async () => {
	// });
});
