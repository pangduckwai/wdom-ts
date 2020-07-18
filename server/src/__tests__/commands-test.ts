require('dotenv').config();
import fetch from 'node-fetch';
import { commandService } from '../commands';
import { CHANNEL } from '..';
import {
	REGISTER_PLAYER, PLAYER_LEAVE, OPEN_GAME, JOIN_GAME, CLOSE_GAME, QUIT_GAME, START_GAME
} from './utils';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = (process.env.REDIS_PORT || 6379) as number;
const servicePort = 4031; // (process.env.COMMANDS_PORT || 4000) as number;
const SERVICE = `http://localhost:${servicePort}/graphql`;
let stopService: () => Promise<number>;

const players: any = {
	pete: '', // game
	josh: '', // game
	saul: '', // game
	jess: '',
	bill: '', // leave
	matt: '',
	nick: '',
	dick: '', // not in game
	dave: '', // leave
	john: '',
	mike: '',
};
const games: any = {
	pete: { id: '', members: ['jess'] },
	josh: { id: '', members: ['matt'] }, // 'nick', 'mike', 'john', 'saul'
	saul: { id: '', members: ['nick', 'mike', 'john'] },
}

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
		console.log(`Unit test of channel ${CHANNEL} finished`);
		console.log(`players: ${JSON.stringify(players, null, ' ')};\ngames:${Object.keys(games).map(k => `\n "${k}": "${games[k].id}"`)}`)
		resolve();
	}, 100));
});

describe('Commands Service tests - Players', () => {
	it('players register in game room', async () => {
		for (const playerName of Object.keys(players)) {
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'RegisterPlayer', query: REGISTER_PLAYER,
					variables: { playerName }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				players[playerName] = data.registerPlayer.id;
				expect(data.registerPlayer.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});

	it('players leave game room', async () => {
		for (const name of ['bill', 'dave']) {
			const playerToken = players[name];
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'LeaveGameRoom', query: PLAYER_LEAVE,
					variables: { playerToken }
			})})
			.then(res => res.json())
			.then(({ data }) => {
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
		for (const playerName of Object.keys(games)) {
			const playerToken = players[playerName];
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'OpenGame', query: OPEN_GAME,
					variables: { playerToken, gameName: `${playerName}\'s game` }
			})})
			.then(res => res.json())
			.then(({ data }) => {
				games[playerName].id = data.openGame.id;
				expect(data.openGame.id).toBeDefined();
			}).catch(_ => expect(false).toBeTruthy());
		}
	});

	it('players join games', async () => {
		for (const gameName of Object.keys(games)) {
			for (const playerName of games[gameName].members) {
				const playerToken = players[playerName];
				const gameToken = games[gameName].id;
				await fetch(SERVICE, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						operationName: 'JoinGame', query: JOIN_GAME,
						variables: { playerToken, gameToken }
				})})
				.then(res => res.json())
				.then(({ data }) => {
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
				variables: { playerToken: players['pete'], gameToken: games['pete'].id }
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
				variables: { playerToken: players['saul'] }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.closeGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('non-host player try to close a game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'CloseGame', query: CLOSE_GAME,
				variables: { playerToken: players['matt'] }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.closeGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('players join another game', async () => {
		const names = [...games['saul'].members, 'saul'];
		for (const playerName of names) {
			const playerToken = players[playerName];
			const gameToken = games['josh'].id;
			await fetch(SERVICE, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					operationName: 'JoinGame', query: JOIN_GAME,
					variables: { playerToken, gameToken }
			})})
			.then(res => res.json())
			.then(({ data }) => {
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
				variables: { playerToken: players['jess'] }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.quitGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

	it('player try to quit his own game', async () => {
		await fetch(SERVICE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operationName: 'QuitGame', query: QUIT_GAME,
				variables: { playerToken: players['pete'] }
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
				variables: { playerToken: players['dick'] }
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
				variables: { playerToken: players['matt'] }
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
				variables: { playerToken: players['jess'], gameToken: games['josh'].id }
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
				variables: { playerToken: players['josh'] }
		})})
		.then(res => res.json())
		.then(({ data }) => {
			expect(data.startGame.id).toBeDefined();
		}).catch(_ => expect(false).toBeTruthy());
	});

});