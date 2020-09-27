import { Commit, createCommit } from '../commands';
import { generateToken, Status } from '..';
import { Card, Game, Player, rules, _shuffle, Territories, WildCards, Territory, Continents, Continent } from '../rules';
import { buildMessage, Message, MessageType } from '.';

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

// const turnEnded = (
// 	world: Record<Continents, Continent>,
// 	players: Record<string, Player>,
// 	games: Record<string, Game>,
// 	playerToken: string,
// 	gameToken: string
// ) => {
// 	const holdings = Object.keys(players[playerToken].holdings).length;
// 	if (holdings > players[playerToken].holdingsCount) {
// 		const card = games[gameToken].cards.pop();
// 		if (card)
// 			players[playerToken].cards[card.name] = card;
// 		else
// 			throw new Error(`No card left in the deck!!!`); // should be impossible to happen
// 	}
// 	games[gameToken].turns ++;
// 	if (games[gameToken].turns >= games[gameToken].players.length) {
// 		games[gameToken].turns = 0;
// 		games[gameToken].round ++;
// 	}
// 	turnStarted(world, players, games, gameToken);
// };

// const troopPlaced = (
// 	world: Record<Continents, Continent>,
// 	players: Record<string, Player>,
// 	games: Record<string, Game>,
// 	playerToken: string,
// 	gameToken: string,
// 	territoryName: string,
// 	amount: number
// ) => {
// 	if (amount !== 0) {
// 		// Both setup phase and game-play phase
// 		players[playerToken].holdings[territoryName].troop += amount;
// 		players[playerToken].reinforcement -= amount;
// 	}
// 	if ((games[gameToken].round === 0) && (amount >= 0)) {
// 		// Setup phase
// 		// If player remove a troop from a territory, stay in that player's turn
// 		games[gameToken].turns ++;
// 		if (games[gameToken].turns >= games[gameToken].players.length)
// 			games[gameToken].turns = 0;

// 		if (games[gameToken].players.filter(k => players[k].reinforcement > 0).length <= 0) {
// 			// SetupFinished
// 			games[gameToken].turns = 0;
// 			games[gameToken].round = 1;
// 			turnStarted(world, players, games, gameToken);
// 		}
// 	}
// };

/**
 * The stages are Opened (-2), Started (-1), GameSetup (0), TurnSetup (>0), GamePlay(>0), the 'before' and 'after' modifiers are for
 * the different error messages, they are inclusive (e.g. BeforeStarted and AfterStarted both expect round also equal -1, just give differnet
 * error message)
 */
enum GameStage {
	Opened,
	BeforeStarted, AfterStarted,
	BeforeGameSetup, AfterGameSetup,
	BeforeTurnSetup, AfterGamePlay
};
const validator = (
	map: Record<Territories, Territory>,
	players: Record<string, Player>,
	games: Record<string, Game>,
) => {
	return ({
		playerToken, playerToken2, gameToken, territory, territory2,
		expected
	}: {
		playerToken?: string;
		playerToken2?: string;
		gameToken?: string;
		territory?: string;
		territory2?: string;
		expected?: GameStage;
	}) => {
		if (playerToken && !players[playerToken]) return `Player ${playerToken} not found`;
		if (playerToken2 && !players[playerToken2]) return `Player ${playerToken2} not found`;
		if (territory && !map[territory as Territories]) return `Unknown territory ${territory}`;
		if (territory2 && !map[territory2 as Territories]) return `Unknown territory ${territory2}`;
		if (territory && territory2)
			if (!map[territory as Territories].connected.has(territory2 as Territories)) return `Territories ${territory} and ${territory2} are not connected`;

		if (gameToken) {
			const game = games[gameToken];
			const player = playerToken ? players[playerToken] : null;

			if (!game) return `Game ${gameToken} not found`;
			if (playerToken) {
				if (game.players.filter(k => k === playerToken).length <= 0) return `Player '${player?.name}' not in game '${game.name}'`;
				if (game.players[game.turns] !== playerToken) return `It is not the turn of player '${player?.name}'`;
			}
			if (playerToken2 && (game.players.filter(k => k === playerToken2).length <= 0)) return `Player ${playerToken2} not in game '${game.name}'`;

			if (typeof expected !== 'undefined') {
				const count = game.players.filter(k => players[k].reinforcement > 0).length;
				switch (expected) {
					case GameStage.Opened:
						if (game.round > -2) return `Game '${game.name}' already started`;
						break;
					case GameStage.BeforeStarted:
						if (game.round > -1) return `Game '${game.name}' already in setup stage`;
						break;
					case GameStage.AfterStarted:
						if (game.round < -1) return `Game '${game.name}' not yet started`;
						break;
					case GameStage.BeforeGameSetup:
						if (game.round > 0) return `Turn already started in game '${game.name}'`;
						if (count <= 0) return `Reinforcement already deployed in game '${game.name}'`;
						break;
					case GameStage.AfterGameSetup:
						if (game.round < 0) return `Game '${game.name}' not yet in setup stage`;
						if (count > 0) return `Undeployed reinforcement still exist in game '${game.name}'`;
						break;
					case GameStage.BeforeTurnSetup:
						if (game.round <= 0) return `Game '${game.name}' not yet ready`;
						if (player && (player.reinforcement <= 0)) return `Reinforcement already deployed in game '${game.name}' for player ${player.name} (${game.round})`;
						break;
					case GameStage.AfterGamePlay:
						if (game.round <= 0) return `Game '${game.name}' not yet ready`;
						if (player && (player.reinforcement > 0)) return `Undeployed troops still exist in game '${game.name}' for player ${player.name} (${game.round})`;
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
		const commits: Commit[] = []; // Commits generated from game logic (here)

		return incoming.reduce(({ players, games, messages }, commit) => {
			const validate = validator(map, players, games);
			let error: string | undefined;
			for (const event of commit.events) {
				switch (event.type) {
					case 'PlayerRegistered':
						if (Object.values(players).filter(player => player.name === event.payload.playerName).length > 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${event.payload.playerName} already registered`));
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

					// case 'GameOpened':
					// 	error = validate({ playerToken: event.payload.playerToken });
					// 	if (!error) {
					// 		if (Object.values(games).filter(game => game.name === event.payload.gameName).length > 0) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${event.payload.gameName} already exists`));
					// 		} else {
					// 			const joined = players[event.payload.playerToken].joined;
					// 			if (joined) {
					// 				messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You already in the game ${games[joined].name} and cannot open a new one`));
					// 			} else {
					// 				games[commit.id] = {
					// 					token: commit.id,
					// 					name: event.payload.gameName,
					// 					host: event.payload.playerToken,
					// 					ruleType: event.payload.ruleType,
					// 					round: -2,
					// 					redeemed: 0,
					// 					turns: 0,
					// 					status: Status.New,
					// 					players: [event.payload.playerToken],
					// 					cards: []
					// 				};
					// 				players[event.payload.playerToken].joined = commit.id;
					// 			}
					// 		}
					// 	} else {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
					// 	}
					// 	break;

					case 'GameClosed':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${event.payload.playerToken} not found`));
						} else {
							const game = Object.values(games).filter(game => game.host === event.payload.playerToken);
							if (game.length <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${players[event.payload.playerToken].name} is not hosting any game`));
							} else if (game.length > 1) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${players[event.payload.playerToken].name} is hosting more than one game`));
							} else {
								games[game[0].token].status = Status.Deleted;
								for (const player of Object.values(players).filter(player => player.joined && (player.joined === game[0].token))) {
									player.joined = undefined;
								}
							}
						}
						break;

					case 'GameJoined':
						error = validate({ playerToken: event.payload.playerToken, gameToken: event.payload.gameToken, expected: GameStage.Opened });
						if (!error) {
							if (games[event.payload.gameToken].host === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Cannot join your own game`));
							}if (players[event.payload.playerToken].joined) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You already joined ${players[event.payload.playerToken].joined}`));
							} else if (Object.values(players).filter(player => player.joined === event.payload.gameToken).length >= rules.MaxPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} already full`));
							} else {
								players[event.payload.playerToken].joined = event.payload.gameToken;
								games[event.payload.gameToken].players.push(event.payload.playerToken);
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'GameQuitted':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${event.payload.playerToken} not found`));
						} else {
							const joinedToken = players[event.payload.playerToken].joined;
							if (!joinedToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You are not in any game currently`));
							} else if (games[joinedToken].host === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You cannot quit your own game`));
							} else {
								players[event.payload.playerToken].joined = undefined;
								games[joinedToken].players = games[joinedToken].players.filter(p => p !== event.payload.playerToken);
							}
						}
						break;

					case 'GameStarted': // Started: round = -1
						error = validate({ playerToken: event.payload.playerToken, gameToken: event.payload.gameToken, expected: GameStage.Opened });
						if (!error) {
							if (games[event.payload.gameToken].host !== event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `You can only start your own game`));
							} else if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Not enough players in the game ${games[event.payload.gameToken].name} yet`));
							} else {
								games[event.payload.gameToken].players = _shuffle(games[event.payload.gameToken].players);
								games[event.payload.gameToken].round = -1;
	
								// ReinforcementArrived
								const playerLen = games[event.payload.gameToken].players.length;
								for (const p of games[event.payload.gameToken].players) {
									players[p].reinforcement = rules.initialTroops(playerLen) - Object.keys(players[p].holdings).length;
								}
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'SetupBegun': // Setup begun: round = 0
						error = validate({ gameToken: event.payload.gameToken, expected: GameStage.AfterStarted });
						if (!error) {
							if (games[event.payload.gameToken].cards.length <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not ready`));
							} else {
								games[event.payload.gameToken].status = Status.Ready;
								games[event.payload.gameToken].turns = 0; // First player start game setup
							}
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					// case 'SetupFinished': // Setup begun: round = 1, status = Ready
					// 	if (!games[event.payload.gameToken]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${event.payload.gameToken} not found`));
					// 	} else if (games[event.payload.gameToken].round < 0) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not yet started`));
					// 	} else if (games[event.payload.gameToken].status !== Status.Ready) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not ready`));
					// 	} else if (games[event.payload.gameToken].players.filter(k => players[k].reinforcement > 0).length > 0) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Reinforcement remaining, setup not yet finish`));
					// 	} else {
					// 		games[event.payload.gameToken].turns = 0;
					// 		games[event.payload.gameToken].round = 1;
					// 		turnStarted(world, players, games, event.payload.gameToken);
					// 	}
					// 	break;
	
					// case 'TerritoryAssigned':
					// 	error = validate({ gameToken: event.payload.gameToken, territory: event.payload.territoryName, expected: GameStage.AfterStarted });
					// 	if (!error) {
					// 		const playerLen = games[event.payload.gameToken].players.length;
					// 		if (games[event.payload.gameToken].turns >= playerLen) {
					// 			games[event.payload.gameToken].turns = playerLen - 1; // Possibily someone just quit game
					// 		} else {
					// 			const playerToken = games[event.payload.gameToken].players[games[event.payload.gameToken].turns];
					// 			const player = players[playerToken];
					// 			const territory = map[event.payload.territoryName as Territories];
					// 			player.holdings[territory.name] = territory;
					// 			player.holdings[territory.name].troop = 1;
					// 			games[event.payload.gameToken].turns ++;
					// 			if (games[event.payload.gameToken].turns >= playerLen) games[event.payload.gameToken].turns = 0;
					// 		}
					// 	} else {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
					// 	}
					// 	break;

					// case 'MoveMade':
					// 	// This is the event when a player click on the map, which depends on situation, will
					// 	// generate specific events, such as attack, add troops, etc.
					// 	if (!players[event.payload.playerToken]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${event.payload.playerToken} not found`));
					// 	} else if (!games[event.payload.gameToken]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${event.payload.gameToken} not found`));
					// 	} else if (!map[event.payload.territoryName as Territories]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Unknown territory ${event.payload.territoryName}`));
					// 	} else if (games[event.payload.gameToken].status !== Status.Ready) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not ready`));
					// 	} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.playerToken) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `This is not yet your turn`));
					// 	} else {
					// 		const flagAll = (event.payload.flag & FLAG_SHIFT) > 0;
					// 		const flagDdc = (event.payload.flag & FLAG_ALT) > 0;
					// 		if (games[event.payload.gameToken].round === 0) {
					// 			// Setup phase
					// 			if (games[event.payload.gameToken].round < 0) {
					// 				messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not yet started`));
					// 			} else {
					// 				if (players[event.payload.playerToken].holdings[event.payload.territoryName]) {
					// 					// Clicked on owned territory, add troops from the player's reinforcement pool, go to next player
					// 					if (players[event.payload.playerToken].reinforcement > 0) {
					// 						let amount = (flagAll && !flagDdc) ? players[event.payload.playerToken].reinforcement : (!flagAll && flagDdc) ? -1 : 1;
					// 						troopPlaced(
					// 							world, players, games,
					// 							event.payload.playerToken,
					// 							event.payload.gameToken,
					// 							event.payload.territoryName,
					// 							amount
					// 						);
					// 					}
					// 				} // else ignore the click on other's territory
					// 			}
					// 		} else {
					// 			// Gameplay phase
					// 			if (games[event.payload.gameToken].round <= 0) {
					// 				messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not yet started`));
					// 			} else {
					// 				if (players[event.payload.playerToken].reinforcement > 0) {
					// 					// Start turn phase
					// 					let amount = (flagAll) ? players[event.payload.playerToken].reinforcement : 1;
					// 					troopPlaced(
					// 						world, players, games,
					// 						event.payload.playerToken,
					// 						event.payload.gameToken,
					// 						event.payload.territoryName,
					// 						amount
					// 					);
					// 				} else {
					// 					// Battle phase
					// 					if (players[event.payload.playerToken].holdings[event.payload.territoryName]) {
					// 						// Click on the player's own territory
					// 					} else if (!map[players[event.payload.playerToken].selected as Territories].connected.has(event.payload.territoryName as Territories)) {
					// 						messages.push(buildMessage(commit.id, MessageType.Message, event.type, `Territories not connected`)); // Ignore move
					// 					} else {
					// 						// ATTACK!
					// 						const fromTerritory = players[event.payload.playerToken].selected;
					// 						const attackers = players[event.payload.playerToken].holdings[fromTerritory].troop;
					// 						const defender = games[event.payload.gameToken].players.filter(p =>
					// 							players[p].holdings[event.payload.territoryName]);
					// 						if (defender.length <= 0) {
					// 							messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Cannot find owner of ${event.payload.territoryName}`));
					// 						} else {
					// 							const defenders = players[defender[0]].holdings[event.payload.territoryName].troop;
					// 							const result = rules.doBattle(attackers, defenders); // TODO record the dice results somewhere!!!
					// 							commits.push(
					// 								createCommit().addEvent<TerritoryAttacked>({
					// 									type: 'TerritoryAttacked',
					// 									payload: {
					// 										fromPlayer: event.payload.playerToken,
					// 										toPlayer: defender[0],
					// 										gameToken: event.payload.gameToken,
					// 										fromTerritory,
					// 										toTerritory: event.payload.territoryName,
					// 										attackerLoss: result.attacker,
					// 										defenderLoss: result.defender
					// 									}
					// 								}).build()
					// 							);
					// 						}
					// 					}
					// 				}
					// 			}
					// 		}
					// 	}
					// 	break;

					// case 'TerritorySelected':
					// 	error = validate({
					// 		playerToken: event.payload.playerToken,
					// 		gameToken: event.payload.gameToken,
					// 		territory: event.payload.territoryName,
					// 		expected: GameStage.AfterGameSetup,
					// 	});
					// 	if (!error) {
					// 		if (!players[event.payload.playerToken].holdings[event.payload.territoryName]) {
					// 			messages.push(buildMessage(commit.id, MessageType.Message, event.type, `${event.payload.territoryName} is not your territory`));
					// 		} else {
					// 			players[event.payload.playerToken].selected = event.payload.territoryName;
					// 		}
					// 	} else {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
					// 	}
					// 	break;

					// case 'TroopPlaced':
					// 	error = validate({
					// 		playerToken: event.payload.playerToken,
					// 		gameToken: event.payload.gameToken,
					// 		territory: event.payload.territoryName,
					// 		expected: GameStage.AfterGameSetup,
					// 	});
					// 	if (!error) {
					// 		if (!players[event.payload.playerToken].holdings[event.payload.territoryName]) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `This is not your territory`));
					// 		} else if (players[event.payload.playerToken].reinforcement < event.payload.amount) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Insufficient reinforcement left`));
					// 		} else {
					// 			if (players[event.payload.playerToken].reinforcement <= 0) {
					// 				messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Turn already started`));
					// 			} else {
					// 				if (event.payload.amount !== 0) {
					// 					// Both setup phase and game-play phase
					// 					players[event.payload.playerToken].holdings[event.payload.territoryName].troop += event.payload.amount;
					// 					players[event.payload.playerToken].reinforcement -= event.payload.amount;
					// 				}
					// 				if ((games[event.payload.gameToken].round === 0) && (event.payload.amount >= 0)) {
					// 					// Setup phase
					// 					// If player remove a troop from a territory, stay in that player's turn
					// 					games[event.payload.gameToken].turns ++;
					// 					if (games[event.payload.gameToken].turns >= games[event.payload.gameToken].players.length)
					// 						games[event.payload.gameToken].turns = 0;
	
					// 					if (games[event.payload.gameToken].players.filter(k => players[k].reinforcement > 0).length <= 0) {
					// 						// SetupFinished
					// 						games[event.payload.gameToken].turns = 0;
					// 						games[event.payload.gameToken].round = 1;
					// 						turnStarted(world, players, games, event.payload.gameToken);
					// 					}
					// 				}
					// 			}
					// 		}
					// 	} else {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
					// 	}
					// 	break;

					// case 'TerritoryAttacked':
					// 	error = validate({
					// 		playerToken: event.payload.fromPlayer,
					// 		playerToken2: event.payload.toPlayer,
					// 		gameToken: event.payload.gameToken,
					// 		territory: event.payload.fromTerritory,
					// 		territory2: event.payload.toTerritory,
					// 		expected: GameStage.AfterGamePlay,
					// 	});
					// 	if (!error) {
					// 		if (!players[event.payload.fromPlayer].holdings[event.payload.fromTerritory]) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Territory ${event.payload.fromTerritory} not owned by attacker`));
					// 		} else if (!players[event.payload.toPlayer].holdings[event.payload.toTerritory]) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Territory ${event.payload.toTerritory} not owned by defender`));
					// 		} else if (
					// 			(event.payload.attackerLoss < 0) || (event.payload.defenderLoss < 0) ||
					// 			((event.payload.attackerLoss === 0) && (event.payload.defenderLoss === 0))
					// 		) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Invalid inputs: attacker loss ${event.payload.attackerLoss} / defender loss ${event.payload.defenderLoss}`));
					// 		} else if (players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop <= event.payload.attackerLoss) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Attacker loss larger than attacker's troops number`));
					// 		} else {
					// 			players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop -= event.payload.attackerLoss;
					// 			if (players[event.payload.toPlayer].holdings[event.payload.toTerritory].troop > event.payload.defenderLoss)
					// 				players[event.payload.toPlayer].holdings[event.payload.toTerritory].troop -= event.payload.defenderLoss;
					// 			else {
					// 				// TerritoryConquered
					// 				delete players[event.payload.toPlayer].holdings[event.payload.toTerritory];
					// 				players[event.payload.fromPlayer].holdings[event.payload.toTerritory] = map[event.payload.toTerritory as Territories];
					// 				players[event.payload.fromPlayer].holdings[event.payload.toTerritory].troop = players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop - 1;
					// 				players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop = 1;
					// 			}
					// 		}
					// 	} else {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
					// 	}
					// 	break;

					// case 'TerritoryConquered':
					// 	if (!players[event.payload.fromPlayer]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${event.payload.fromPlayer} not found`));
					// 	} else if (!players[event.payload.toPlayer]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Player ${event.payload.toPlayer} not found`));
					// 	} else if (!games[event.payload.gameToken]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${event.payload.gameToken} not found`));
					// 	} else if (!map[event.payload.fromTerritory as Territories]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Unknown territory ${event.payload.fromTerritory}`));
					// 	} else if (!map[event.payload.toTerritory as Territories]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Unknown territory ${event.payload.toTerritory}`));
					// 	} else if (games[event.payload.gameToken].round <= 0) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not yet started`));
					// 	} else if (games[event.payload.gameToken].status !== Status.Ready) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not ready`));
					// 	} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.fromPlayer) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `This is not yet your turn`));
					// 	} else if (!players[event.payload.fromPlayer].holdings[event.payload.fromTerritory]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Territory ${event.payload.fromTerritory} not owned by attacker`));
					// 	} else if (!players[event.payload.toPlayer].holdings[event.payload.toTerritory]) {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Territory ${event.payload.toTerritory} not owned by defender`));
					// 	} else {
					// 		delete players[event.payload.toPlayer].holdings[event.payload.toTerritory];
					// 		players[event.payload.fromPlayer].holdings[event.payload.toTerritory] = map[event.payload.toTerritory as Territories];
					// 		players[event.payload.fromPlayer].holdings[event.payload.toTerritory].troop = players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop - 1;
					// 		players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop = 1;
					// 	}
					// 	break;

					// case 'TerritoryFortified':
					// 	error = validate({
					// 		playerToken: event.payload.playerToken,
					// 		gameToken: event.payload.gameToken,
					// 		territory: event.payload.fromTerritory,
					// 		territory2: event.payload.toTerritory,
					// 		expected: GameStage.AfterGamePlay,
					// 	});
					// 	if (!error) {
					// 		if (!players[event.payload.playerToken].holdings[event.payload.fromTerritory]) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `${event.payload.fromTerritory} is not your territory`));
					// 		} else if (!players[event.payload.playerToken].holdings[event.payload.toTerritory]) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `${event.payload.toTerritory} is not your territory`));
					// 		} else if (event.payload.amount >= players[event.payload.playerToken].holdings[event.payload.fromTerritory].troop) {
					// 			messages.push(buildMessage(commit.id, MessageType.Error, event.type, `${event.payload.fromTerritory} does not have enough troops to move`));
					// 		} else {
					// 			players[event.payload.playerToken].holdings[event.payload.fromTerritory].troop -= event.payload.amount;
					// 			players[event.payload.playerToken].holdings[event.payload.toTerritory].troop += event.payload.amount;
					// 			turnEnded(world, players, games, event.payload.playerToken, event.payload.gameToken)
					// 		}
					// 	} else {
					// 		messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
					// 	}
					// 	break;

					case 'PlayerDefeated':
						// TODO
						break;

					case 'TurnEnded':
						error = validate({
							playerToken: event.payload.playerToken,
							gameToken: event.payload.gameToken,
							expected: GameStage.AfterGameSetup,
						});
						if (!error) {
							//turnEnded(world, players, games, event.payload.playerToken, event.payload.gameToken);
						} else {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, error));
						}
						break;

					case 'CardReturned':
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, event.type, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else {
							games[event.payload.gameToken].cards.push(deck[event.payload.cardName as Territories | WildCards]);
						}
						break;

					case 'CardsRedeemed':
						// TODO
						break;

					case 'GameWon':
						// TODO
						break;
				}
			}
			return { players, games, messages, commits };
		}, initial ? {
			...initial,
			messages
		} : {
			players: {},
			games: {},
			messages
		});
	};
};
