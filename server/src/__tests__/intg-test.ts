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
		console.log('Integration tests finished', channel);
		resolve();
	}, 1000));
});

const playerSession = {
	'paul': ''
};
const playerSessions = {
	'pete': '',
	'josh': '',
	'saul': '',
	'jess': '',
	'bill': '',
	'matt': '',
	'john': '',
	'mike': ''
};

const headers = { 'content-type': 'application/json' };
// if (accessToken) headers['authorization'] = `bearer ${accessToken}`;

describe('Integration test', () => {
	it('player register to game room', async () => {
		const result = await fetch(cmdUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				operationName: 'RegisterPlayer', query: QUERIES['RegisterPlayer'][1], variables: { playerName: 'paul' }
			})
		})
		.then(res => res.json());
		console.log('HA', JSON.stringify(result.data[QUERIES['RegisterPlayer'][0]], null, ' '));
	});
});