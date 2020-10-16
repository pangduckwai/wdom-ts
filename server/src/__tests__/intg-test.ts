require('dotenv').config();
jest.mock('../rules/card');
jest.mock('../rules/rules');
import fetch from 'node-fetch';
import { commandService } from '../commands';
import { queryService } from '../queries';
import { SELECTS, UPDATES } from './utils';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = (process.env.REDIS_PORT || 6379) as number;
const commandPort = 4101; // (process.env.COMMANDS_PORT || 4000) as number;
const queriesPort = 4102; // (process.env.QUERIES_PORT || 4000) as number;
const channel = `wdom${Date.now()}intg`
const cmdUrl = `http://localhost:${commandPort}/graphql`;
const qryUrl = `http://localhost:${queriesPort}/graphql`;
const ruleType = 'TRADITIONAL';

let stopCmd: () => Promise<void>;
let stopQry: () => Promise<void>;

const games: Record<string, {
	token: string;
	name: string;
	status: string;
	round: number;
	turns: number;
	players: {
		token: string;
		name: string;
		status: string;
		selected?: string;
		joined?: string;
		holdings: {
			name: string;
			troop: number;
		}[]
	}[];
	lastBattleR?: number[];
	lastBattleW?: number[];
}> = {};
const players: Record<string, {
	token: string;
	name: string;
	status: string;
	reinforcement: number;
	selected?: string;
	joined?: string;
	cards: string[];
	holdings: {
		name: string;
		troop: number;
	}[];
}> = {};

const output = (hostName: string) => {
	const x = Object.values(players).filter(p => p.name === hostName)[0].token;
	const g = games[players[x].joined || ''];
	const output = 
`>>> "${g.name}" [status: ${g.status}] [round: ${g.round}] [turn: ${g.turns}] ${(g.lastBattleR ? `[red: ${g.lastBattleR}` : '')}; ${(g.lastBattleW ? `white: ${g.lastBattleW}]` : '')}
Members:${g.players.map(p => {
	return `\n  ${p.token === x ? '*' : '-' } "${p.name}" [status: ${p.status}] [joined: "${(p.joined ? games[p.joined].name : '')}"] [selected: ${p.selected}]
....holdings:${p.holdings.map(t => ` ${t.name}[${t.troop}]`)}`;
})}`;
	console.log(output.replace(/[.][.][.][.]/gi, '    '));

	const room = `Game room:${Object.values(players).map(p => {
		return `\n "${p.name}" [token: ${p.token}] [status: ${p.status}] [reinforcement: ${p.reinforcement}] [joined: "${(p.joined ? games[p.joined].name : '')}"]`;
	})}`;
	console.log(room);
};

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
	await new Promise((resolve) => setTimeout(() => resolve(), 1000));
	output('josh');
});

const playerSessions: Record<string, {
	token: string;
	session: string;
}> = {
	'pete': { token: '', session: '' },
	'josh': { token: '', session: '' },
	'saul': { token: '', session: '' },
	'jess': { token: '', session: '' },
	'bill': { token: '', session: '' },
	'matt': { token: '', session: '' },
	'nick': { token: '', session: '' },
	'dick': { token: '', session: '' },
	'dave': { token: '', session: '' },
	'john': { token: '', session: '' },
	'mike': { token: '', session: '' }
};
const gameList: Record<string, {
	token: string;
	name: string;
	members: string[];
}> = {
	'pete': { token: '', name: 'pete\'s game', members: ['jess']},
	'josh': { token: '', name: 'josh\'s game', members: ['matt']},
	'saul': { token: '', name: 'saul\'s game', members: ['nick', 'mike', 'john']}
};

const getHeaders = (playerName?: string) => {
	const headers: any = { 'content-type': 'application/json' };
	if (playerName)
		headers['authorization'] = playerSessions[playerName].session;
	return headers;
};

describe('Integration test - Game Room', () => {
	it('players register in game room', async () => {
		for (const playerName of Object.keys(playerSessions)) {
			await fetch(cmdUrl, {
				method: 'POST', headers: getHeaders(),
				body: JSON.stringify({ operationName: UPDATES[0][1], query: UPDATES[0][2], variables: { playerName }})
			}).then(res => {
				return res.json();
			}).then(({ data, errors }) => {
				if (errors) {
					console.log('player register to game room', errors);
					expect(false).toBeTruthy();
				} else {
					playerSessions[playerName] = { token: data[UPDATES[0][0]].id, session: data[UPDATES[0][0]].session };
					expect(data[UPDATES[0][0]].session).toBeTruthy();
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});

	it('players leave game room', async () => {
		for (const playerName of Object.keys(playerSessions).filter(p => p === 'bill' || p === 'dave')) {
			await fetch(cmdUrl, {
				method: 'POST', headers: getHeaders(playerName),
				body: JSON.stringify({ operationName: UPDATES[1][1], query: UPDATES[1][2], variables: {}})
			}).then(res => {
				return res.json();
			}).then(({ data, errors }) => {
				if (errors) {
					console.log('players leave game room', errors);
					expect(false).toBeTruthy();
				} else {
					playerSessions[playerName] = { token: '', session: data[UPDATES[1][0]].session };
					expect(data[UPDATES[1][0]].session).toBeTruthy();
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});

	it('add duplicated player name', async () => {
		const { data: cdata, errors: cerrors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('josh'),
			body: JSON.stringify({ operationName: UPDATES[0][1], query: UPDATES[0][2], variables: { playerName: 'josh' }})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (cerrors) {
			console.log('add duplicated player name (commands)', cerrors);
			expect(false).toBeTruthy();
			return;
		}
		const commitId = cdata[UPDATES[0][0]].id;
		await fetch(qryUrl, {
			method: 'POST', headers: getHeaders('josh'),
			body: JSON.stringify({ operationName: SELECTS[0][1], query: SELECTS[0][2], variables: { commitId }})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('add duplicated player name (queries)', errors);
				expect(false).toBeTruthy();
			} else {
				expect(data[SELECTS[0][0]][0].message).toEqual('[josh] already registered');
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('non-existing player leave', async () => {
		const headers = getHeaders();
		headers['authorization'] = '12345678901357924680';
		await fetch(cmdUrl, {
			method: 'POST', headers,
			body: JSON.stringify({ operationName: UPDATES[1][1], query: UPDATES[1][2], variables: {}})
		}).then(res => {
			return res.json();
		}).then(({ errors }) => {
			expect(errors[0].message).toEqual('Authentication error');
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('players open games', async () => {
		for (const hostName of Object.keys(gameList)) {
			await fetch(cmdUrl, {
				method: 'POST', headers: getHeaders(hostName),
				body: JSON.stringify({ operationName: UPDATES[2][1], query: UPDATES[2][2], variables: { gameName: gameList[hostName].name, ruleType }})
			}).then(res => {
				return res.json();
			}).then(({ data, errors }) => {
				if (errors) {
					console.log('players open games', errors);
					expect(false).toBeTruthy();
				} else {
					playerSessions[hostName].session = data[UPDATES[2][0]].session;
					gameList[hostName].token = data[UPDATES[2][0]].id;
					expect(data[UPDATES[2][0]].session).toBeTruthy();
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});

	it('players join games', async () => {
		for (const hostName of Object.keys(gameList)) {
			for (const playerName of gameList[hostName].members) {
				await fetch(cmdUrl, {
					method: 'POST', headers: getHeaders(playerName),
					body: JSON.stringify({ operationName: UPDATES[4][1], query: UPDATES[4][2], variables: { gameToken: gameList[hostName].token }})
				}).then(res => {
					return res.json();
				}).then(({ data, errors }) => {
					if (errors) {
						console.log('players join games', errors);
						expect(false).toBeTruthy();
					} else {
						playerSessions[playerName].session = data[UPDATES[4][0]].session;
						expect(data[UPDATES[4][0]].session).toBeTruthy();
					}
				}).catch(error => {
					console.log(error);
					expect(false).toBeTruthy();
				});
			}
		}
	});

	it('player join his/her own game', async () => {
		const { data: cdata, errors: cerrors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('pete'),
			body: JSON.stringify({ operationName: UPDATES[4][1], query: UPDATES[4][2], variables: { gameToken: gameList['pete'].token }})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (cerrors) {
			console.log('player join his/her own game (commands)', cerrors);
			expect(false).toBeTruthy();
			return;
		}
		playerSessions['pete'].session = cdata[UPDATES[4][0]].session;
		const commitId = cdata[UPDATES[4][0]].id;
		await fetch(qryUrl, {
			method: 'POST', headers: getHeaders('pete'),
			body: JSON.stringify({ operationName: SELECTS[0][1], query: SELECTS[0][2], variables: { commitId }})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player join his/her own game (queries)', errors);
				expect(false).toBeTruthy();
			} else {
				expect(data[SELECTS[0][0]][0].message).toEqual('[pete] don\'t need to join one\'s own game');
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('player close game', async () => {
		await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('saul'),
			body: JSON.stringify({ operationName: UPDATES[3][1], query: UPDATES[3][2], variables: {}})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player close game', errors);
				expect(false).toBeTruthy();
			} else {
				playerSessions['saul'].session = data[UPDATES[3][0]].session;
				gameList['saul'].token = '';
				expect(data[UPDATES[3][0]].session).toBeTruthy();
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('non-host player try to close a game', async () => {
		const { data: cdata, errors: cerrors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('matt'),
			body: JSON.stringify({ operationName: UPDATES[3][1], query: UPDATES[3][2], variables: {}})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (cerrors) {
			console.log('non-host player try to close a game (commands)', cerrors);
			expect(false).toBeTruthy();
			return;
		}
		playerSessions['matt'].session = cdata[UPDATES[3][0]].session;
		const commitId = cdata[UPDATES[3][0]].id;
		await fetch(qryUrl, {
			method: 'POST', headers: getHeaders('matt'),
			body: JSON.stringify({ operationName: SELECTS[0][1], query: SELECTS[0][2], variables: { commitId }})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('non-host player try to close a game (queries)', errors);
				expect(false).toBeTruthy();
			} else {
				expect(data[SELECTS[0][0]][0].message).toEqual('[matt] is not the host of game "josh\'s game"');
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('players join another game', async () => {
		let names = [ ...gameList['saul'].members, 'saul' ];
		for (const playerName of names) {
			await fetch(cmdUrl, {
				method: 'POST', headers: getHeaders(playerName),
				body: JSON.stringify({ operationName: UPDATES[4][1], query: UPDATES[4][2], variables: { gameToken: gameList['josh'].token }})
			}).then(res => {
				return res.json();
			}).then(({ data, errors }) => {
				if (errors) {
					console.log('players join another game', errors);
					expect(false).toBeTruthy();
				} else {
					playerSessions[playerName].session = data[UPDATES[4][0]].session;
					expect(data[UPDATES[4][0]].session).toBeTruthy();
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});

	it('try to start a game with too few players', async () => {
		const { errors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('pete'),
			body: JSON.stringify({ operationName: UPDATES[6][1], query: UPDATES[6][2], variables: {}})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (errors) {
			expect(errors[0].message).toEqual('Not enough players in the game "pete\'s game" yet');
		} else {
			expect(false).toBeTruthy();
		}
	});

	it('player quit a game', async () => {
		await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('jess'),
			body: JSON.stringify({ operationName: UPDATES[5][1], query: UPDATES[5][2], variables: {}})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player quit a game', errors);
				expect(false).toBeTruthy();
			} else {
				playerSessions['jess'].session = data[UPDATES[5][0]].session;
				expect(data[UPDATES[5][0]].session).toBeTruthy();
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('player try to quit his own game', async () => {
		const { data: cdata, errors: cerrors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('pete'),
			body: JSON.stringify({ operationName: UPDATES[5][1], query: UPDATES[5][2], variables: {}})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (cerrors) {
			console.log('player try to quit his own game (commands)', cerrors);
			expect(false).toBeTruthy();
			return;
		}
		playerSessions['pete'].session = cdata[UPDATES[5][0]].session;
		const commitId = cdata[UPDATES[5][0]].id;
		await fetch(qryUrl, {
			method: 'POST', headers: getHeaders('pete'),
			body: JSON.stringify({ operationName: SELECTS[0][1], query: SELECTS[0][2], variables: { commitId }})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player try to quit his own game (queries)', errors);
				expect(false).toBeTruthy();
			} else {
				expect(data[SELECTS[0][0]][0].message).toEqual('[pete] cannot quit from the game one is hosting');
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('player not in a game try to quit game', async () => {
		const { data: cdata, errors: cerrors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('dick'),
			body: JSON.stringify({ operationName: UPDATES[5][1], query: UPDATES[5][2], variables: {}})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (cerrors) {
			console.log('player not in a game try to quit game (commands)', cerrors);
			expect(false).toBeTruthy();
			return;
		}
		playerSessions['dick'].session = cdata[UPDATES[5][0]].session;
		const commitId = cdata[UPDATES[5][0]].id;
		await fetch(qryUrl, {
			method: 'POST', headers: getHeaders('dick'),
			body: JSON.stringify({ operationName: SELECTS[0][1], query: SELECTS[0][2], variables: { commitId }})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player not in a game try to quit game (queries)', errors);
				expect(false).toBeTruthy();
			} else {
				expect(data[SELECTS[0][0]][0].message).toEqual('[dick] is not in any game currently');
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('non-host player try to start a game', async () => {
		const { errors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('matt'),
			body: JSON.stringify({ operationName: UPDATES[6][1], query: UPDATES[6][2], variables: {}})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (errors) {
			expect(errors[0].message).toEqual('[commands.StartGame] [matt] is not the host of game "josh\'s game"');
		} else {
			expect(false).toBeTruthy();
		}
	});

	it('player try to join a full game', async () => {
		const { data: cdata, errors: cerrors } = await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('jess'),
			body: JSON.stringify({ operationName: UPDATES[4][1], query: UPDATES[4][2], variables: { gameToken: gameList['josh'].token }})
		}).then(res => {
			return res.json();
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
		if (cerrors) {
			console.log('player try to join a full game (commands)', cerrors);
			expect(false).toBeTruthy();
			return;
		}
		playerSessions['jess'].session = cdata[UPDATES[4][0]].session;
		const commitId = cdata[UPDATES[4][0]].id;
		await fetch(qryUrl, {
			method: 'POST', headers: getHeaders('jess'),
			body: JSON.stringify({ operationName: SELECTS[0][1], query: SELECTS[0][2], variables: { commitId }})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player try to join a full game (queries)', errors);
				expect(false).toBeTruthy();
			} else {
				expect(data[SELECTS[0][0]][0].message).toEqual('Game "josh\'s game" already full');
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});

	it('player start a game', async () => {
		await fetch(cmdUrl, {
			method: 'POST', headers: getHeaders('josh'),
			body: JSON.stringify({ operationName: UPDATES[6][1], query: UPDATES[6][2], variables: {}})
		}).then(res => {
			return res.json();
		}).then(({ data, errors }) => {
			if (errors) {
				console.log('player start a game', errors);
				expect(false).toBeTruthy();
			} else {
				playerSessions['josh'].session = data[UPDATES[6][0]].session;
				expect(data[UPDATES[6][0]].session).toBeTruthy();
			}
		}).catch(error => {
			console.log(error);
			expect(false).toBeTruthy();
		});
	});
});

describe('Integration test - Game play', () => {
});

describe('Integration test - queries', () => {
	it('query registered players', async () => {
		for (const playerName of Object.keys(playerSessions).filter(p => playerSessions[p].token && playerSessions[p].session)) {
			await fetch(qryUrl, {
				method: 'POST', headers: getHeaders(playerName),
				body: JSON.stringify({ operationName: SELECTS[1][1], query: SELECTS[1][2], variables: {}})
			}).then(res => {
				return res.json();
			}).then(({ data, errors }) => {
				if (errors) {
					console.log('query registered players', errors);
					expect(false).toBeTruthy();
				} else {
					players[data[SELECTS[1][0]].token] = data[SELECTS[1][0]];
					expect(data[SELECTS[1][0]].name).toEqual(playerName);
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});

	it('query opened games', async () => {
		for (const hostName of Object.keys(gameList).filter(g => !!gameList[g].token)) {
			await fetch(qryUrl, {
				method: 'POST', headers: getHeaders(hostName),
				body: JSON.stringify({ operationName: SELECTS[2][1], query: SELECTS[2][2], variables: {}})
			}).then(res => {
				return res.json();
			}).then(({ data, errors }) => {
				if (errors) {
					console.log('query opened games', errors);
					expect(false).toBeTruthy();
				} else {
					games[data[SELECTS[2][0]].token] = data[SELECTS[2][0]];
					expect(data[SELECTS[2][0]].name).toEqual(gameList[hostName].name);
				}
			}).catch(error => {
				console.log(error);
				expect(false).toBeTruthy();
			});
		}
	});
});
