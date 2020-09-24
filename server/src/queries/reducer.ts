import { Commit, PositionFortified, TerritoryAttacked } from '../commands';
import { generateToken } from '..';
import {
	buildMap, buildWorld,
	Card, Game, Player, rules, _shuffle, Territories, WildCards, Territory,
	Continents, Continent, getValidator, GameStage, Expected, RuleTypes
} from '../rules';
import { buildMessage, Message, MessageType, Status } from '.';

const turnStarted = (
	world: Record<Continents, Continent>,
	players: Record<string, Player>,
	games: Record<string, Game>,
	gameToken: string
) => {
	const playerToken = games[gameToken].players[games[gameToken].turns];

	// ReinforcementArrived
	players[playerToken].reinforcement =
		rules.basicReinforcement(players[playerToken].holdings) +
		rules.continentReinforcement(world, players[playerToken].holdings);
};

const turnEnded = (
	players: Record<string, Player>,
	games: Record<string, Game>,
	playerToken: string,
	gameToken: string
) => {
	if (players[playerToken].wonBattle === games[gameToken].round) {
		const card = games[gameToken].cards.pop();
		if (card) players[playerToken].cards[card?.name] = card;
	}
	games[gameToken].turns ++;
	if (games[gameToken].turns >= games[gameToken].players.length) {
		games[gameToken].turns = 0;
		games[gameToken].round ++;
	}
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
								reinforcement: 0,
								status: Status.New,
								holdings: [],
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
										ruleType: event.payload.ruleType,
										round: -1,
										redeemed: 0,
										turns: 0,
										status: Status.New,
										players: [event.payload.playerToken],
										cards: [],
										world: buildWorld(),
										map: buildMap()
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
						if (games[event.payload.gameToken].ruleType === RuleTypes.SETUP_RANDOM) {
							error = validate({
								playerToken: event.payload.playerToken,
								hostToken: event.payload.playerToken,
								gameToken: event.payload.gameToken,
								territory: event.payload.territory,
								expectedStage: { expected: Expected.OnOrBefore, stage: GameStage.GameOpened }
							});
						} else {
							error = validate({
								playerToken: event.payload.playerToken,
								gameToken: event.payload.gameToken,
								territory: event.payload.territory,
								expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameStarted }
							});
						}
						if (!error) {
							const playerLen = games[event.payload.gameToken].players.length;
							if (games[event.payload.gameToken].turns >= playerLen) {
								games[event.payload.gameToken].turns = playerLen - 1; // Possibily someone just quit game
							} else if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Not enough players in the game "${games[event.payload.gameToken].name}" yet`));
							} else {
								const playerToken = games[event.payload.gameToken].players[games[event.payload.gameToken].turns];
								const player = players[playerToken];
								player.holdings.push(event.payload.territory as Territories);
								games[event.payload.gameToken].map[event.payload.territory as Territories].troop = 1;
								if (games[event.payload.gameToken].ruleType === RuleTypes.SETUP_TRADITIONAL) player.reinforcement --;
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
							cards: [event.payload.card]
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

							if (games[event.payload.gameToken].cards.filter(c => c.name === event.payload.card).length > 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Card "${event.payload.card}" already in the deck`));
							} else {
								games[event.payload.gameToken].cards.push(deck[event.payload.card as Territories | WildCards]);
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
									players[p].reinforcement = rules.initialTroops(playerLen) - players[p].holdings.length;
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'TerritorySelected':
						error = validate({
							playerToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							territory: event.payload.territory,
							expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameStarted }
						});
						if (!error) {
							players[event.payload.playerToken].selected = event.payload.territory;
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'TroopPlaced':
						error = validate({
							playerToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							territory: event.payload.territory,
							expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameStarted }
						});
						if (!error) {
							if (players[event.payload.playerToken].holdings.filter(t => t === event.payload.territory).length <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Cannot place troops on another player's territory`));
							} else if (players[event.payload.playerToken].reinforcement < event.payload.amount) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Insufficient reinforcement`));
							} else {
								games[event.payload.gameToken].map[event.payload.territory as Territories].troop += event.payload.amount;
								players[event.payload.playerToken].reinforcement -= event.payload.amount;
								if (games[event.payload.gameToken].round === 0) {
									// Setup phase
									if (games[event.payload.gameToken].players.filter(p => players[p].reinforcement > 0).length <= 0) {
										// Setup phase done, move to first player's first turn
										games[event.payload.gameToken].round = 1;
										games[event.payload.gameToken].turns = 0;
										turnStarted(world, players, games, event.payload.gameToken);
									} else if (event.payload.amount >= 0) {
										// Setup phase continue, next player's turn, unless the player just deduct a troop from one territory
										let count = 0;
										do {
											count ++;
											games[event.payload.gameToken].turns ++;
											if (games[event.payload.gameToken].turns >= games[event.payload.gameToken].players.length)
												games[event.payload.gameToken].turns = 0;
										} while (
											(players[games[event.payload.gameToken].players[games[event.payload.gameToken].turns]].reinforcement <= 0) &&
											(count < games[event.payload.gameToken].players.length)
										);
										if (players[games[event.payload.gameToken].players[games[event.payload.gameToken].turns]].reinforcement <= 0) {
											games[event.payload.gameToken].round = 1;
											games[event.payload.gameToken].turns = 0;
											turnStarted(world, players, games, event.payload.gameToken);
										}
									}
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'TerritoryAttacked':
						const payload0 = (event as TerritoryAttacked).payload;
						error = validate({
							playerToken: payload0.fromPlayer,
							playerToken2: payload0.toPlayer,
							gameToken: payload0.gameToken,
							territory: payload0.fromTerritory,
							territory2: payload0.toTerritory,
							expectedStage: { expected: Expected.After, stage: GameStage.GameStarted }
						});
						if (!error) {
							if (games[payload0.gameToken].map[payload0.fromTerritory].troop < 2) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Insufficient troops to initiate an attack`));
							} else if (
								(payload0.attackerLoss < 0) || (payload0.defenderLoss < 0) ||
								((payload0.attackerLoss === 0) && (payload0.defenderLoss === 0))
							) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Invalid inputs: attacker loss ${payload0.attackerLoss} / defender loss ${payload0.defenderLoss}`));
							} else if (games[payload0.gameToken].map[payload0.fromTerritory].troop <= payload0.attackerLoss) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Attacker loss larger than attacker's troops number`));
							} else {
								games[payload0.gameToken].lastBattle = { redDice: payload0.redDice, whiteDice: payload0.whiteDice }
								games[payload0.gameToken].map[payload0.fromTerritory].troop -= payload0.attackerLoss;
								if (games[payload0.gameToken].map[payload0.toTerritory].troop > payload0.defenderLoss) {
									games[payload0.gameToken].map[payload0.toTerritory].troop -= payload0.defenderLoss;
									players[payload0.fromPlayer].selected = payload0.fromTerritory;
								} else {
									// TerritoryConquered
									players[payload0.toPlayer].holdings = players[payload0.toPlayer].holdings.filter(h => h !== payload0.toTerritory);
									players[payload0.fromPlayer].holdings.push(payload0.toTerritory);
									games[payload0.gameToken].map[payload0.toTerritory].troop = games[payload0.gameToken].map[payload0.fromTerritory].troop - 1;
									games[payload0.gameToken].map[payload0.fromTerritory].troop = 1;
									players[payload0.fromPlayer].wonBattle = games[payload0.gameToken].round;

									// TODO: Check if toPlayer lost all holdings
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'TurnEnded':
						error = validate({
							playerToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameInProgress }
						});
						if (!error) {
							turnEnded(players, games, event.payload.playerToken, event.payload.gameToken);
							turnStarted(world, players, games, event.payload.gameToken); // TODO: need to check end-game condition?
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'PositionFortified':
						const payload1 = (event as PositionFortified).payload;
						error = validate({
							playerToken: payload1.playerToken,
							gameToken: payload1.gameToken,
							territory: payload1.fromTerritory,
							territory2: payload1.toTerritory,
							expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameInProgress }
						});
						if (!error) {
							if ((players[payload1.playerToken].holdings.filter(t => t === payload1.toTerritory).length <= 0) ||
									(players[payload1.playerToken].holdings.filter(t => t === payload1.fromTerritory).length <= 0)) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Cannot fortify other player's position`));
							} else if (payload1.amount <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Invalid fortification amount`));
							} else if (payload1.amount >= games[payload1.gameToken].map[payload1.fromTerritory].troop) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Insufficient troops to fortify`));
							} else {
								games[payload1.gameToken].map[payload1.fromTerritory].troop -= payload1.amount;
								games[payload1.gameToken].map[payload1.toTerritory].troop += payload1.amount;
								players[payload1.playerToken].selected = payload1.toTerritory;
								turnEnded(players, games, payload1.playerToken, payload1.gameToken);
								turnStarted(world, players, games, payload1.gameToken); // TODO: need to check end-game condition?
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