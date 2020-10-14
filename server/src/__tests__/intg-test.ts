require('dotenv').config();
import fetch from 'node-fetch';
import { commandService } from '../commands';
import { queryService } from '../queries';
import { QUERIES } from './utils';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = (process.env.REDIS_PORT || 6379) as number;
const commandPort = (process.env.COMMANDS_PORT || 4000) as number;
const queriesPort = (process.env.QUERIES_PORT || 4000) as number;
const channel = `wdom${Date.now()}intg`
const cmdUrl = `http://localhost:${commandPort}/graphql`;
const qryUrl = `http://localhost:${queriesPort}/graphql`;

let stopCmd: () => Promise<void>;
let stopQry: () => Promise<void>;

beforeAll(async () => {
	const { start: cmdStart, stop: cmdStop } = await commandService({ channel, redisHost, redisPort, servicePort: commandPort});
	stopCmd = cmdStop;
	cmdStart().then(({ url }) => {
		console.log(`🚀 WDOM Commands Service started at ${url} with channel ${channel}`);
	});

	const { start: qryStart, stop: qryStop } = await queryService({ channel, redisHost, redisPort, servicePort: queriesPort});
	stopQry = qryStop;
	qryStart().then(({ url }) => {
		console.log(`🚀 WDOM Queries Service started at  ${url} with channel ${channel}`);
	});
});

afterAll(async () => {
	await stopQry();
	await stopCmd();
	return new Promise(resolve => setTimeout(() => {
		console.log('Integration tests finished', channel, '\nPlayer', JSON.stringify(playerSessions, null, ' '));
		resolve();
	}, 1000));
});

// afterEach(async () => {
// 	await new Promise((resolve) => setTimeout(() => resolve(), 1000));
// });

const playerSessions: Record<string, {
	token: string;
	session: string;
}> = {
	'paul': { token: '', session: '' },
	'pete': { token: '', session: '' },
	'dave': { token: '', session: '' },
	'josh': { token: '', session: '' },
	'saul': { token: '', session: '' },
	'jess': { token: '', session: '' },
	'bill': { token: '', session: '' },
	'matt': { token: '', session: '' },
	'john': { token: '', session: '' },
	'mike': { token: '', session: '' }
};
const gameList: Record<string, string[]> = {
	'pete': ['jess'],
	'josh': ['matt'],
	'saul': ['paul', 'mike', 'john']
};

const getHeaders = (playerName?: string) => {
	const headers: any = { 'content-type': 'application/json' };
	if (playerName)
		headers['authorization'] = playerSessions[playerName].session;
	return headers;
};

describe('Integration test', () => {
	it('players register in game room', async () => {
		for (const playerName of Object.keys(playerSessions)) {
			await fetch(cmdUrl, {
				method: 'POST', headers: getHeaders(),
				body: JSON.stringify({ operationName: QUERIES[0][1], query: QUERIES[0][2], variables: { playerName }})
			}).then(res => res.json())
				.then(({ data, errors }) => {
				if (errors) {
					console.log('player register to game room', errors);
					expect(false).toBeTruthy();
				} else {
					playerSessions[playerName] = { token: data[QUERIES[0][0]].id, session: data[QUERIES[0][0]].session };
					expect(data[QUERIES[0][0]]).toBeTruthy();
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});

	// it('players leave game room', async () => {
	// 	for (const playerName of Object.keys(playerSessions).filter(p => p === 'bill' || p === 'dave')) {
	// 		await fetch(cmdUrl, {
	// 			method: 'POST', headers: getHeaders(playerName),
	// 			body: JSON.stringify({ operationName: QUERIES[1][1], query: QUERIES[1][2], variables: {}})
	// 		}).then(res => res.json())
	// 			.then(({ data, errors }) => {
	// 			if (errors) {
	// 				console.log('players leave game room', errors);
	// 				expect(false).toBeTruthy();
	// 			} else {
	// 				playerSessions[playerName] = { token: '', session: data[QUERIES[1][0]].session };
	// 				expect(data[QUERIES[1][0]]).toBeTruthy();
	// 			}
	// 		}).catch(error => {
	// 			console.log(error);
	// 			expect(false).toBeTruthy();
	// 		});
	// 	}
	// });
});