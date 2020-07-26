require('dotenv').config();
jest.mock('../rules/card');
import fetch from 'node-fetch';
import { commandService } from '../commands';
import { Game, Player, Status, isPlayer } from '../queries';
import { buildMap, shuffle, Territories, Territory } from '../rules';
import {
	REGISTER_PLAYER, PLAYER_LEAVE, OPEN_GAME, JOIN_GAME, CLOSE_GAME, QUIT_GAME, START_GAME, ASSIGN_TERRITORY
} from './utils';

/**
 * This is NOT an integration test. In this test only the commands services is started. The purpose
 * is to test commits can be successfully written to the backend. Thus the 'players' and 'games' objects
 * are faked by updating them manually after each successful test. They are to remember the tokens for
 * subsequence tests.
 */

const CHANNEL = `ctest${Date.now()}`;
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = (process.env.REDIS_PORT || 6379) as number;
const servicePort = 4031; // (process.env.COMMANDS_PORT || 4000) as number;
const SERVICE = `http://localhost:${servicePort}/graphql`;
let stopService: () => Promise<number>;

// pete: ['jess']
// josh: ['josh', 'matt'] // 'nick', 'mike', 'john', 'saul'
// saul: ['nick', 'mike', 'john']
const playerNames = ['pete', 'josh', 'saul', 'jess', 'bill', 'matt', 'nick', 'dick', 'dave', 'john', 'mike'];
const gameHosts: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'], // 'nick', 'mike', 'john', 'saul'
	'saul': ['nick', 'mike', 'john']
};
let players: Record<string, Player> = {};
let games: Record<string, Game> = {};

 beforeAll(async () => {
	const { start, stop } = await commandService({ channel: CHANNEL, redisHost, redisPort, servicePort});
	stopService = stop;

	start().then(({ url }) => {
		console.log(`🚀 WDOM Commands Service started at ${url}`);
	});
});

afterAll(async () => {
	await stopService();
	return new Promise((resolve) => setTimeout(() => {
		console.log(`Commands test of channel ${CHANNEL} finished`);
		console.log(`players: ${
			Object.keys(players).map(p => {
				const holds = players[p].holdings;
				return `\n "${p}": "${JSON.stringify(Object.keys(holds ? holds : {}))}"`;
			})
		};\ngames:${
			Object.keys(games).map(k => {
				const player = games[k].players.map(p => isPlayer(p) ? p.name : p);
				return `\n "${k}": (${games[k].round}) "${JSON.stringify(player)}"`;
			})
		}`);
		resolve();
	}, 100));
});

describe('Commands Service tests - Players', () => {
	it('players register in game room', async () => {
		for (const playerName of playerNames) {
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'RegisterPlayer', query: REGISTER_PLAYER,
					variables: { playerName }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				players[playerName] = {
					token: data.registerPlayer.id,
					name: playerName,
					reinforcement: 0,
					status: Status.New
				};
				expect(data.registerPlayer.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});

	it('players leave game room', async () => {
		for (const playerName of ['bill', 'dave']) {
			const playerToken = players[playerName].token;
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'LeaveGameRoom', query: PLAYER_LEAVE,
					variables: { playerToken }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				delete players[playerName];
				expect(data.leaveGameRoom.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});

	it('add duplicated player name', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'RegisterPlayer', query: REGISTER_PLAYER,
				variables: { playerName: 'josh' }
		})})
		.then(res => res.json())
		.then(result => {
			console.log(result);
			return result;
		})
		.then(({ data }) => {
			expect(data.registerPlayer.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('non-existing player leave', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'LeaveGameRoom', query: PLAYER_LEAVE,
				variables: { playerToken: '123456789' }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.leaveGameRoom.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});
});

describe('Commands Service tests - Prepare Games', () => {
	it('players open games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			const hostToken = players[hostName].token;
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'OpenGame', query: OPEN_GAME,
					variables: { playerToken: hostToken, gameName: `${hostName}\'s game` }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				games[hostName] = {
					token: data.openGame.id,
					name: `${hostName}\'s game`,
					host: hostToken,
					round: -1,
					redeemed: 0,
					status: Status.New,
					players: [players[hostName]]
				};
				expect(data.openGame.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});

	it('players join games', async () => {
		for (const hostName of Object.keys(gameHosts)) {
			for (const playerName of gameHosts[hostName]) {
				const playerToken = players[playerName].token;
				const gameToken = games[hostName].token;
				await fetch(SERVICE, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						operationName: 'JoinGame', query: JOIN_GAME,
						variables: { playerToken, gameToken }
				})})
				.then(res => res.json())
				.then(({ data }) => {
					players[playerName].joined = games[hostName];
					games[hostName].players.push(players[playerName]);
					expect(data.joinGame.id).toBeDefined();
				}).catch(_ => expect(false).toBeTruthy());
			}
		}
	});

	it('player join his own game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'JoinGame', query: JOIN_GAME,
				variables: { playerToken: players['pete'].token, gameToken: games['pete'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.joinGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('player close game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'CloseGame', query: CLOSE_GAME,
				variables: { playerToken: players['saul'].token, gameToken: games['saul'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			delete games['saul'];
			expect(data.closeGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('non-host player try to close a game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'CloseGame', query: CLOSE_GAME,
				variables: { playerToken: players['matt'].token, gameToken: games['josh'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.closeGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('players join another game', async () => {
		const names = [...gameHosts['saul'], 'saul'];
		for (const playerName of names) {
			const playerToken = players[playerName].token;
			const gameToken = games['josh'].token;
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'JoinGame', query: JOIN_GAME,
					variables: { playerToken, gameToken }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				players[playerName].joined = games['josh'];
				games['josh'].players.push(players[playerName]);
				expect(data.joinGame.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});

	it('player quit a game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'QuitGame', query: QUIT_GAME,
				variables: { playerToken: players['jess'].token, gameToken: games['pete'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			players['jess'].joined = undefined;
			games['pete'].players = games['pete'].players.filter(p => isPlayer(p) ? p.token !== players['jess'].token : p !== players['jess'].token);
			expect(data.quitGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('player try to quit his own game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'QuitGame', query: QUIT_GAME,
				variables: { playerToken: players['pete'].token, gameToken: games['pete'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.quitGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('player not in a game try to quit game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'QuitGame', query: QUIT_GAME,
				variables: { playerToken: players['dick'].token, gameToken: games['josh'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.quitGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('non-host player try to start a game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'StartGame', query: START_GAME,
				variables: { playerToken: players['matt'].token, gameToken: games['josh'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.startGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('player try to join a full game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'JoinGame', query: JOIN_GAME,
				variables: { playerToken: players['jess'].token, gameToken: games['josh'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.joinGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('player start a game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'StartGame', query: START_GAME,
				variables: { playerToken: players['josh'].token, gameToken: games['josh'].token }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			games['josh'].round = 0;
			expect(data.startGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});
});

describe('Commands Service tests - Prepare Games', () => {
	it('assign territories', async () => {
		let p = 0
		for (const territory of shuffle<Territories, Territory>(buildMap())) {
			const player = games['josh'].players[p];
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'AssignTerritory', query: ASSIGN_TERRITORY,
					variables: { playerToken: isPlayer(player) ? player.token : player, gameToken: games['josh'].token, territoryName: territory.name }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				if (isPlayer(player)) {
					if (!player.holdings) player.holdings = {};
					player.holdings[territory.name] = territory;
				}
				p = (p+1) % games['josh'].players.length;
				expect(data.assignTerritory.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});
});