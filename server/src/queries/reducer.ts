import { Commit } from '../commands';
import { generateToken } from '..';
import { Card, rules, _shuffle, Territories, WildCards, Territory, Continents, Continent, getValidator, GameStage, Expected } from '../rules';
import { buildMessage, Game, Message, MessageType, Player, Status } from '.';

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
		const validator = getValidator(map, deck);
		const messages: Message[] = []; // Message to the client (mainly error messages)

		return incoming.reduce(({ players, games, messages }, commit) => {
			const validate = validator(players, games);
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
							const joinedToken = players[event.payload.playerToken].joined;
							if (joinedToken) {
								error = validate({ hostToken: event.payload.playerToken, gameToken: joinedToken });
								if (!error) {
									if (games[joinedToken].round >= 0) {
										messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game "${games[joinedToken].name}" in progress and cannot be closed`));
									} else {
										games[joinedToken].status = Status.Deleted;
										for (const player of Object.values(players).filter(player => player.joined && (player.joined === joinedToken))) {
											player.joined = undefined;
										}
									}
								} else {
									messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
								}
							} else {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player "${players[event.payload.playerToken].name}" is not hosting any game`));
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameJoined':
						error = validate({
							playerToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							expectedStage: { expected: Expected.OnOrBefore, stage: GameStage.GameOpened }
						});
						if (!error) {
							if (games[event.payload.gameToken].host === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You don't need to join your own game`));
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
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You cannot quit from the game you are hosting`));
							} else {
								players[event.payload.playerToken].joined = undefined;
								games[joinedToken].players = games[joinedToken].players.filter(p => p !== event.payload.playerToken);
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'PlayerShuffled':
						error = validate({
							playerToken: event.payload.playerToken,
							hostToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							expectedStage: { expected: Expected.OnOrBefore, stage: GameStage.GameOpened }
						});
						if (!error) {
							if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Not enough players in the game "${games[event.payload.gameToken].name}" yet`));
							} else {
								games[event.payload.gameToken].players = event.payload.players;
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'TerritoryAssigned':
						error = validate({
							playerToken: event.payload.playerToken,
							hostToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							territory: event.payload.territoryName,
							expectedStage: { expected: Expected.OnOrBefore, stage: GameStage.GameOpened }
						});
						if (!error) {
							const playerLen = games[event.payload.gameToken].players.length;
							if (games[event.payload.gameToken].turns >= playerLen) {
								games[event.payload.gameToken].turns = playerLen - 1; // Possibily someone just quit game
							} else if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Not enough players in the game "${games[event.payload.gameToken].name}" yet`));
							} else {
								const playerToken = games[event.payload.gameToken].players[games[event.payload.gameToken].turns];
								const player = players[playerToken];
								const territory = map[event.payload.territoryName as Territories];
								player.holdings[territory.name] = territory;
								player.holdings[territory.name].troop = 1;
								games[event.payload.gameToken].turns ++;
								if (games[event.payload.gameToken].turns >= playerLen) games[event.payload.gameToken].turns = 0;
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'CardReturned':
						error = validate({
							playerToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							cards: [event.payload.cardName]
						});
						if (!error) {
							if (games[event.payload.gameToken].round < 0) {
								// From StartGame
								if (games[event.payload.gameToken].host !== event.payload.playerToken) {
									messages.push(buildMessage(
										commit.id, MessageType.Error, event.type,
										`Player "${players[event.payload.playerToken].name}" is not the host of game "${games[event.payload.gameToken].name}"`
									));
									break;
								}
							} else if (games[event.payload.gameToken].round === 0) {
								// Error
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Event "CardReturned" is invalid during game setup phase`));
								break;
							}

							if (games[event.payload.gameToken].cards.filter(c => c.name === event.payload.cardName).length > 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Card "${event.payload.cardName}" already in the deck`));
							} else {
								games[event.payload.gameToken].cards.push(deck[event.payload.cardName as Territories | WildCards]);
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameStarted':
						error = validate({
							playerToken: event.payload.playerToken,
							hostToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							expectedStage: { expected: Expected.OnOrBefore, stage: GameStage.GameOpened }
						});
						if (!error) {
							if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Not enough players in the game "${games[event.payload.gameToken].name}" yet`));
							} else {
								games[event.payload.gameToken].status = Status.Ready;
								games[event.payload.gameToken].round = 0;
								games[event.payload.gameToken].turns = 0; // First player start game setup

								const playerLen = games[event.payload.gameToken].players.length; // ReinforcementArrived
								for (const p of games[event.payload.gameToken].players) {
									players[p].reinforcement = rules.initialTroops(playerLen) - Object.keys(players[p].holdings).length;
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'TroopPlaced':
						error = validator(players, games)({
							playerToken: event.payload.playerToken,
							hostToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							territory: event.payload.territoryName,
							expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameStarted }
						});
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