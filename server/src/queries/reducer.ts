import { FLAG_SHIFT, FLAG_ALT } from '..';
import {
	Commit, createCommit, generateToken, ReinforcementArrived, SetupFinished,
	TerritoryAttacked, TerritoryConquered, TerritorySelected, TroopPlaced, TurnStarted
} from '../commands';
import { Card, rules, _shuffle, Territories, WildCards, Territory, Continents, Continent } from '../rules';
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
		const messages: Message[] = []; // Message to the client (mainly error messages)
		const commits: Commit[] = []; // Commits generated from game logic (here)

		return incoming.reduce(({ players, games, messages, commits }, commit) => {
			for (const event of commit.events) {
				switch (event.type) {
					case 'PlayerRegistered':
						if (Object.values(players).filter(player => player.name === event.payload.playerName).length > 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerName} already registered`));
						} else {
							players[commit.id] = {
								token: commit.id,
								name: event.payload.playerName,
								reinforcement: 0,
								status: Status.New,
								cards: {},
								holdings: {},
								sessionid: generateToken()
							};
						}
						break;

					case 'PlayerLeft':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (players[event.payload.playerToken].joined) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Please quit any current game before leaving`));
						} else {
							players[event.payload.playerToken].status = Status.Deleted;
						}
						break;

					case 'GameOpened':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (Object.values(games).filter(game => game.name === event.payload.gameName).length > 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameName} already exists`));
						} else {
							const joined = players[event.payload.playerToken].joined;
							if (joined) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You already in the game ${games[joined].name} and cannot open a new one`));
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
									selected: [],
									cards: []
								};
								players[event.payload.playerToken].joined = commit.id;
							}
						}
						break;

					case 'GameClosed':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else {
							const game = Object.values(games).filter(game => game.host === event.payload.playerToken);
							if (game.length <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Player ${players[event.payload.playerToken].name} is not hosting any game`));
							} else if (game.length > 1) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Player ${players[event.payload.playerToken].name} is hosting more than one game`));
							} else {
								games[game[0].token].status = Status.Deleted;
								for (const player of Object.values(players).filter(player => player.joined && (player.joined === game[0].token))) {
									player.joined = undefined;
								}
							}
						}
						break;

					case 'GameJoined':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].host === event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Cannot join your own game`));
						} else if (games[event.payload.gameToken].round >= 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} already started`));
						} else if (players[event.payload.playerToken].joined) {
							messages.push(buildMessage(commit.id, MessageType.Error, `You already joined ${players[event.payload.playerToken].joined}`));
						} else if (Object.values(players).filter(player => player.joined === event.payload.gameToken).length >= rules.MaxPlayerPerGame) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} already full`));
						} else {
							players[event.payload.playerToken].joined = event.payload.gameToken;
							games[event.payload.gameToken].players.push(event.payload.playerToken);
						}
						break;

					case 'GameQuitted':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else {
							const joinedToken = players[event.payload.playerToken].joined;
							if (!joinedToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You are not in any game currently`));
							} else if (games[joinedToken].host === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You cannot quit your own game`));
							} else {
								players[event.payload.playerToken].joined = undefined;
								games[joinedToken].players = games[joinedToken].players.filter(p => p !== event.payload.playerToken);
								// TODO remove quitted player's 'selected' entry as well
							}
						}
						break;

					case 'GameStarted': // Setup begun: round = 0, status = New
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].host !== event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `You can only start your own game`));
						} else if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Not enough players in the game ${games[event.payload.gameToken].name} yet`));
						} else {
							games[event.payload.gameToken].players = _shuffle(games[event.payload.gameToken].players);
							games[event.payload.gameToken].round = 0; // status not equal Status.Ready yet
						}
						break;

					case 'SetupBegun': // Setup begun: round = 0, status = Ready
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].cards.length <= 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else {
							games[event.payload.gameToken].status = Status.Ready;
							games[event.payload.gameToken].turns = 0; // First player start gaame setup
						}
						break;

					case 'SetupFinished': // Setup begun: round = 1, status = Ready
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players.filter(k => players[k].reinforcement > 0).length > 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Reinforcement remaining, setup not yet finish`));
						} else {
							games[event.payload.gameToken].turns = 0;
							games[event.payload.gameToken].round = 1;
							commits.push(
								createCommit().addEvent<TurnStarted>({
									type: 'TurnStarted',
									payload: { gameToken: event.payload.gameToken }
								}).build()
							);
						}
						break;
	
					case 'TerritoryAssigned':
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (!map[event.payload.territoryName as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.territoryName}`));
						} else if (event.payload.playerToken) {
							// Territory assigned during game play
							if (!players[event.payload.playerToken]) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
							} else if (games[event.payload.gameToken].status !== Status.Ready) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
							} else if (!players[event.payload.playerToken].joined) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You are not in any game currently`));
							} else {
								const player = players[event.payload.playerToken];
								const territory = map[event.payload.territoryName as Territories];
								player.holdings[territory.name] = territory;
							}
						} else {
							// Territory assigned during game setup
							const playerLen = games[event.payload.gameToken].players.length;
							if (games[event.payload.gameToken].turns >= playerLen) {
								games[event.payload.gameToken].turns = playerLen - 1; // Possibily someone just quit game
							} else {
								const playerToken = games[event.payload.gameToken].players[games[event.payload.gameToken].turns];
								const player = players[playerToken];
								const territory = map[event.payload.territoryName as Territories];
								player.holdings[territory.name] = territory;
								player.holdings[territory.name].troop = 1;
								games[event.payload.gameToken].turns ++;
								if (games[event.payload.gameToken].turns >= playerLen) games[event.payload.gameToken].turns = 0;
							}
						}
						break;

					case 'ReinforcementArrived':
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (event.payload.playerToken) {
							// Assign reinforcement to players during start of turns
							if (!players[event.payload.playerToken]) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
							} else if (games[event.payload.gameToken].round <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
							} else if (games[event.payload.gameToken].status !== Status.Ready) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
							} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, `This is not yet your turn`));
							} else if (!players[event.payload.playerToken].joined) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You are not in any game currently`));
							} else {
								players[event.payload.playerToken].reinforcement =
									rules.basicReinforcement(players[event.payload.playerToken].holdings) +
									rules.continentReinforcement(world, players[event.payload.playerToken].holdings);
							}
						} else {
							// Assign reinforcement to players during game setup
							if (games[event.payload.gameToken].round < 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
							} else {
								const playerLen = games[event.payload.gameToken].players.length;
								for (const p of games[event.payload.gameToken].players) {
									players[p].reinforcement = rules.initialTroops(playerLen) - Object.keys(players[p].holdings).length;
								}
							}
						}
						break;

					case 'MoveMade':
						// This is the event when a player click on the map, which depends on situation, will
						// generate specific events, such as attack, add troops, etc.
						// TODO: how to initiate new commits (or just events?) from the reducer (here) ?!!?!
						//    -> try returning the created commits back to caller, and call this reducer again immediately
						// NOTE!!! "secondary" events, that is, events generated here in the reducer based on game logic,
						//    should not generate events that lead to a loop (i.e. event chain that the last event generate
						//    the first again). The depth of secondary events are limited to 5 levels in subscriptions.ts
						// NOTE!!! Also note that these secondary commits are not recorded (not written to Redis). However this
						//    is okay for replays because these commits came be fully deduced by the primary ones
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (!map[event.payload.territoryName as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.territoryName}`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `This is not yet your turn`));
						} else {
							const flagAll = (event.payload.flag & FLAG_SHIFT) > 0;
							const flagDdc = (event.payload.flag & FLAG_ALT) > 0;
							if (games[event.payload.gameToken].round === 0) {
								// Setup phase
								if (games[event.payload.gameToken].round < 0) {
									messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
								} else {
									if (players[event.payload.playerToken].holdings[event.payload.territoryName]) {
										// Clicked on owned territory, add troops from the player's reinforcement pool, go to next player
										if (players[event.payload.playerToken].reinforcement > 0) {
											let amount = (flagAll && !flagDdc) ? players[event.payload.playerToken].reinforcement : (!flagAll && flagDdc) ? -1 : 1;
											commits.push(
												createCommit().addEvent<TroopPlaced>({
													type: 'TroopPlaced',
													payload : {
														playerToken: event.payload.playerToken,
														gameToken: event.payload.gameToken,
														territoryName: event.payload.territoryName,
														amount
													}
												}).build()
											);
										}
									} // else ignore the click on other's territory
								}
							} else {
								// Gameplay phase
								if (games[event.payload.gameToken].round <= 0) {
									messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
								} else {
									if (players[event.payload.playerToken].reinforcement > 0) {
										// Start turn phase
										let amount = (flagAll) ? players[event.payload.playerToken].reinforcement : 1;
										commits.push(
											createCommit().addEvent<TroopPlaced>({
												type: 'TroopPlaced',
												payload : {
													playerToken: event.payload.playerToken,
													gameToken: event.payload.gameToken,
													territoryName: event.payload.territoryName,
													amount
												}
											}).build()
										);
									} else {
										// Battle phase
										if (players[event.payload.playerToken].holdings[event.payload.territoryName]) {
											commits.push(
												createCommit().addEvent<TerritorySelected>({
													type: 'TerritorySelected',
													payload: {
														playerToken: event.payload.playerToken,
														gameToken: event.payload.gameToken,
														territoryName: event.payload.territoryName
													}
												}).build()
											);
										} else {
											// ATTACK!
											const fromTerritory = games[event.payload.gameToken].selected[games[event.payload.gameToken].turns];
											const attackers = players[event.payload.playerToken].holdings[fromTerritory].troop;
											const defender = games[event.payload.gameToken].players.filter(p =>
												players[p].holdings[event.payload.territoryName]);
											if (defender.length <= 0) {
												messages.push(buildMessage(commit.id, MessageType.Error, `Cannot find owner of ${event.payload.territoryName}`));
											} else {
												const defenders = players[defender[0]].holdings[event.payload.territoryName].troop;
												const result = rules.doBattle(attackers, defenders); // TODO record the dice results somewhere!!!
												commits.push(
													createCommit().addEvent<TerritoryAttacked>({
														type: 'TerritoryAttacked',
														payload: {
															fromPlayer: event.payload.playerToken,
															toPlayer: defender[0],
															gameToken: event.payload.gameToken,
															fromTerritory,
															toTerritory: event.payload.territoryName,
															attackerLoss: result.attacker,
															defenderLoss: result.defender
														}
													}).build()
												);
											}
										}
									}
								}
							}
						}
						break;

					case 'TerritorySelected':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (!map[event.payload.territoryName as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.territoryName}`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `This is not yet your turn`));
						} else {
							games[event.payload.gameToken].selected[games[event.payload.gameToken].turns] = event.payload.territoryName
						}
						break;

					case 'TerritoryAttacked':
						// TODO: check territories are connected.....................
						if (!players[event.payload.fromPlayer]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.fromPlayer} not found`));
						} else if (!players[event.payload.toPlayer]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.toPlayer} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (!map[event.payload.fromTerritory as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.fromTerritory}`));
						} else if (!map[event.payload.toTerritory as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.toTerritory}`));
						} else if (games[event.payload.gameToken].round <= 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.fromPlayer) {
							messages.push(buildMessage(commit.id, MessageType.Error, `This is not yet your turn`));
						} else if (!players[event.payload.fromPlayer].holdings[event.payload.fromTerritory]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Territory ${event.payload.fromTerritory} not owned by attacker`));
						} else if (!players[event.payload.toPlayer].holdings[event.payload.toTerritory]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Territory ${event.payload.toTerritory} not owned by defender`));
						} else if (
							(event.payload.attackerLoss < 0) || (event.payload.defenderLoss < 0) ||
							((event.payload.attackerLoss === 0) && (event.payload.defenderLoss === 0))
						) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Invalid inputs: attacker loss ${event.payload.attackerLoss} / defender loss ${event.payload.defenderLoss}`));
						} else if (players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop <= event.payload.attackerLoss) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Attacker loss larger than attacker's troops number`));
						} else {
							players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop -= event.payload.attackerLoss;
							if (players[event.payload.toPlayer].holdings[event.payload.toTerritory].troop > event.payload.defenderLoss)
								players[event.payload.toPlayer].holdings[event.payload.toTerritory].troop -= event.payload.defenderLoss;
							else {
								// Territory Conquered
								commits.push(
									createCommit().addEvent<TerritoryConquered>({
										type: 'TerritoryConquered',
										payload: {
											fromPlayer: event.payload.playerToken,
											toPlayer: event.payload.toPlayer,
											gameToken: event.payload.gameToken,
											fromTerritory: event.payload.fromTerritory,
											toTerritory: event.payload.territoryName
										}
									}).build()
								);
							}
						}
						break;

					case 'TerritoryConquered':
						if (!players[event.payload.fromPlayer]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.fromPlayer} not found`));
						} else if (!players[event.payload.toPlayer]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.toPlayer} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (!map[event.payload.fromTerritory as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.fromTerritory}`));
						} else if (!map[event.payload.toTerritory as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.toTerritory}`));
						} else if (games[event.payload.gameToken].round <= 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.fromPlayer) {
							messages.push(buildMessage(commit.id, MessageType.Error, `This is not yet your turn`));
						} else if (!players[event.payload.fromPlayer].holdings[event.payload.fromTerritory]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Territory ${event.payload.fromTerritory} not owned by attacker`));
						} else if (!players[event.payload.toPlayer].holdings[event.payload.toTerritory]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Territory ${event.payload.toTerritory} not owned by defender`));
						} else {
							delete players[event.payload.toPlayer].holdings[event.payload.toTerritory];
							players[event.payload.fromPlayer].holdings[event.payload.toTerritory] = map[event.payload.toTerritory as Territories];
							players[event.payload.fromPlayer].holdings[event.payload.toTerritory].troop = players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop - 1;
							players[event.payload.fromPlayer].holdings[event.payload.fromTerritory].troop = 1;
							// Remember player can get card at end of turn
						}
						break;

					case 'TerritoryFortified':
						// TODO
						break;

					case 'PlayerDefeated':
						// TODO
						break;

					case 'TroopPlaced':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (!map[event.payload.territoryName as Territories]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Unknown territory ${event.payload.territoryName}`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players[games[event.payload.gameToken].turns] !== event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `This is not yet your turn`));
						} else if (!players[event.payload.playerToken].holdings[event.payload.territoryName]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `This is not your territory`));
						} else if (players[event.payload.playerToken].reinforcement < event.payload.amount) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Insufficient reinforcement left`));
						} else {
							if (players[event.payload.playerToken].reinforcement <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Turn already started`));
							} else {
								if (event.payload.amount !== 0) {
									// Both setup phase and game-play phase
									players[event.payload.playerToken].holdings[event.payload.territoryName].troop += event.payload.amount;
									players[event.payload.playerToken].reinforcement -= event.payload.amount;
								}
								if ((games[event.payload.gameToken].round === 0) && (event.payload.amount >= 0)) {
									// Setup phase
									// If player remove a troop from a territory, stay in that player's turn
									games[event.payload.gameToken].turns ++;
									if (games[event.payload.gameToken].turns >= games[event.payload.gameToken].players.length)
										games[event.payload.gameToken].turns = 0;

									if (games[event.payload.gameToken].players.filter(k => players[k].reinforcement > 0).length <= 0) {
										commits.push(
											createCommit().addEvent<SetupFinished>({
												type: 'SetupFinished',
												payload: { gameToken: event.payload.gameToken }
											}).build()
										);
									}
								}
								commits.push(
									createCommit().addEvent<TerritorySelected>({
										type: 'TerritorySelected',
										payload: {
											playerToken: event.payload.playerToken,
											gameToken: event.payload.gameToken,
											territoryName: event.payload.territoryName
										}
									}).build()
								);
							}
						}
						break;

					case 'TurnStarted':
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].round <= 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
						} else if (games[event.payload.gameToken].status !== Status.Ready) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not ready`));
						} else if (games[event.payload.gameToken].players.filter(k => players[k].reinforcement > 0).length > 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Reinforcement remaining, setup not yet finish`));
						} else {
							const playerToken = games[event.payload.gameToken].players[games[event.payload.gameToken].turns];
							commits.push(
								createCommit().addEvent<ReinforcementArrived>({
									type: 'ReinforcementArrived',
									payload: { playerToken, gameToken: event.payload.gameToken }
								}).build()
							);
						}
						break;

					case 'TurnEnded':
						// TODO
						break;

					case 'CardReturned':
						if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (games[event.payload.gameToken].round < 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} not yet started`));
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
			messages,
			commits
		} : {
			players: {},
			games: {},
			messages,
			commits
		});
	};
};
