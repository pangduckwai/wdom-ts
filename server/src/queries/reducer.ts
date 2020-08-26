import { Commit, createCommit } from '../commands';
import { generateToken, TurnEnded } from '..';
import { Card, rules, _shuffle, Territories, WildCards, Territory, Continents, Continent } from '../rules';
import { buildMessage, Game, Message, MessageType, Player, Status } from '.';

/**
 * The stages are Opened (-2), Started (-1), GameSetup (0), TurnSetup (>0), GamePlay(>0), the 'before' and 'after' modifiers are for
 * the different error messages, they are inclusive (e.g. BeforeStarted and AfterStarted both expect round also equal -1, just give differnet
 * error message)
 */
enum GameStage {
	/** round =-1; Waiting for other players to join, go to next stage by host's action */
	GameOpened,
	/** round = 0 total reinforcement > 0; Waiting for players to deploy all troops, check after
	 *  every move, automatically go to next stage (round += 1) once total reinforcement == 0 */
	GameStarted,
	/** round > 0; Waiting for player to finish the turn, go to GameInProgress
	 * stage of the next player in line */
	GameInProgress
};

enum Expected {
	Before, OnOrBefore, OnOrAfter, After // both inclusive
}

const validator = (
	map: Record<Territories, Territory>,
	players: Record<string, Player>,
	games: Record<string, Game>,
) => {
	return ({
		playerToken, playerToken2, gameToken, territory, territory2, expectedStage
	}: {
		playerToken?: string;
		playerToken2?: string;
		gameToken?: string;
		territory?: string;
		territory2?: string;
		expectedStage?: { expected: Expected, stage: GameStage; };
	}) => {
		if (playerToken && !players[playerToken]) return `Player "${playerToken}" not found`;
		if (playerToken2 && !players[playerToken2]) return `Player "${playerToken2}" not found`;
		if (territory && !map[territory as Territories]) return `Unknown territory "${territory}"`;
		if (territory2 && !map[territory2 as Territories]) return `Unknown territory "${territory2}"`;
		if (territory && territory2) {
			if (!map[territory as Territories].connected.has(territory2 as Territories))
				return `Territories "${territory}" and "${territory2}" are not connected`;
		}

		if (gameToken) {
			const game = games[gameToken];
			const player = playerToken ? players[playerToken] : null;

			if (!game) return `Game "${gameToken}" not found`;
			if (playerToken) {
				if (game.round >= 0) {
					// Players already join games
					if (game.players.filter(k => k === playerToken).length <= 0)
						return `Player "${player?.name}" not in game "${game.name}"`;
					if (game.players[game.turns] !== playerToken)
						return `It is not the turn of player "${player?.name}"`;
				}
			}
			if (playerToken2 && (game.players.filter(k => k === playerToken2).length <= 0))
				return `Player "${playerToken2}" not in game "${game.name}"`;

			if (typeof expectedStage !== 'undefined') {
				const count = game.players.filter(k => players[k].reinforcement > 0).length;
				switch (expectedStage.stage) {
					case GameStage.GameOpened: // round: -1
						switch (expectedStage.expected) {
							case Expected.Before:
								return 'Invalid expected game stage "Before game opened"';
							case Expected.OnOrBefore:
								if (game.round > -1) return `Game "${game.name}" already started`;
								break;
							case Expected.OnOrAfter: // "On or after game opened" always true
								break;
							case Expected.After:
								if (game.round <= -1) return `Game "${game.name}" not yet started`;
								break;
						}
						break;
					case GameStage.GameStarted: // round: 0
						switch (expectedStage.expected) {
							case Expected.Before:
								if (game.round >= 0) return `Game "${game.name}" already started`;
								break;
							case Expected.OnOrBefore:
								if (game.round > 0) return `Game "${game.name}" already in progress`;
								break;
							case Expected.OnOrAfter:
								if (game.round < 0) return `Game "${game.name}" not yet started`;
								break;
							case Expected.After:
								if (game.round <= 0) return `Game "${game.name}" not yet ready`;
								break;
						}
						break;
					case GameStage.GameInProgress:
						switch (expectedStage.expected) {
							case Expected.Before:
								if (game.round >= 1) return `Game "${game.name}" already in progress`;
								break;
							case Expected.OnOrBefore:
								return 'Invalid expected game stage "On or before game in progress"';
							case Expected.OnOrAfter:
								if (game.round <= 0) return `Game "${game.name}" not yet ready`;
								break;
							case Expected.After:
								return 'Invalid expected game stage "After game in progress"';
						}
						break;
				}
			}
		}
	};
};

export const reducer = (
	world: Record<Continents, Continent>,
	map: Record<Territories, Territory>,
	deck: Record<Territories | WildCards, Card>
) => {
	return (
		incoming: Commit[],
		initial?: {
			players: Record<string, Player>;
			games: Record<string, Game>;
		}
	) => {
		const messages: Message[] = []; // Message to the client (mainly error messages)

		return incoming.reduce(({ players, games, messages }, commit) => {
			const validate = validator(map, players, games);
			let error: string | undefined;
			for (const event of commit.events) {
				switch (event.type) {
					case 'PlayerRegistered':
						if (Object.values(players).filter(player => player.name === event.payload.playerName).length > 0) {
							messages.push(buildMessage(
								commit.id, MessageType.Error, event.type, `Player "${event.payload.playerName}" already registered`
							));
						} else {
							players[commit.id] = {
								token: commit.id,
								name: event.payload.playerName,
								selected: '',
								reinforcement: 0,
								status: Status.New,
								holdings: {},
								holdingsCount: 0,
								cards: {},
								sessionid: generateToken()
							};
						}
						break;

					case 'PlayerLeft':
						error = validate({ playerToken: event.payload.playerToken });
						if (!error) {
							if (players[event.payload.playerToken].joined) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Please quit any current game before leaving`));
							} else {
								players[event.payload.playerToken].status = Status.Deleted;
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameOpened':
						error = validate({ playerToken: event.payload.playerToken });
						if (!error) {
							if (Object.values(games).filter(game => game.name === event.payload.gameName).length > 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game "${event.payload.gameName}" already exists`));
							} else {
								const joined = players[event.payload.playerToken].joined;
								if (joined) {
									messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You already in the game "${games[joined].name}" and cannot open a new one`));
								} else {
									games[commit.id] = {
										token: commit.id,
										name: event.payload.gameName,
										host: event.payload.playerToken,
										round: -1,
										redeemed: 0,
										turns: 0,
										status: Status.New,
										players: [event.payload.playerToken],
										cards: []
									};
									players[event.payload.playerToken].joined = commit.id;
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameClosed':
						error = validate({ playerToken: event.payload.playerToken });
						if (!error) {
							const game = Object.values(games).filter(game => game.host === event.payload.playerToken);
							if (game.length <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player "${players[event.payload.playerToken].name}" is not hosting any game`));
							} else if (game.length > 1) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player "${players[event.payload.playerToken].name}" is hosting more than one game`));
							} else if (games[game[0].token].round >= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game "${games[game[0].token].name}" in progress and cannot be closed`));
							} else {
								games[game[0].token].status = Status.Deleted;
								for (const player of Object.values(players).filter(player => player.joined && (player.joined === game[0].token))) {
									player.joined = undefined;
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameJoined':
						error = validate({
							playerToken: event.payload.playerToken, gameToken: event.payload.gameToken, expectedStage: {
								expected: Expected.OnOrBefore, stage: GameStage.GameOpened
						}});
						if (!error) {
							if (games[event.payload.gameToken].host === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You already in your own game`));
							}if (players[event.payload.playerToken].joined) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You already joined game "${players[event.payload.playerToken].joined}"`));
							} else if (Object.values(players).filter(player => player.joined === event.payload.gameToken).length >= rules.MaxPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game "${games[event.payload.gameToken].name}" already full`));
							} else {
								players[event.payload.playerToken].joined = event.payload.gameToken;
								games[event.payload.gameToken].players.push(event.payload.playerToken);
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameQuitted':
						error = validate({ playerToken: event.payload.playerToken });
						if (!error) {
							const joinedToken = players[event.payload.playerToken].joined;
							if (!joinedToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You are not in any game currently`));
							} else if (games[joinedToken].host === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You cannot quit the game you are hosting`));
							} else {
								players[event.payload.playerToken].joined = undefined;
								games[joinedToken].players = games[joinedToken].players.filter(p => p !== event.payload.playerToken);
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;
				}
			}
			return { players, games, messages };
		}, initial ? {
			...initial,
			messages
		} : {
			players: {},
			games: {},
			messages
		});
	}
};