import { Commit, generateToken } from '../commands';
import { Card, rules, shuffle, Territories, WildCards, Territory } from '../rules';
import { buildMessage, Game, getToken, Message, MessageType, Player, Status } from '.';
import { isGame } from './games';

export const reducer = (
	map: Record<Territories, Territory>,
	deck: Record<Territories | WildCards, Card>
) => {
	return (
		commits: Commit[],
		initial?: {
			players: Record<string, Player>;
			games: Record<string, Game>;
		}
	) => {
		const messages: Message[] = [];
		return commits.reduce(({ players, games, messages }, commit) => {
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
								messages.push(buildMessage(commit.id, MessageType.Error, `You already in the game ${isGame(joined) ? joined.name : games[joined].name} and cannot open a new one`));
							} else {
								games[commit.id] = {
									token: commit.id,
									name: event.payload.gameName,
									host: players[event.payload.playerToken],
									round: -1,
									redeemed: 0,
									status: Status.New,
									players: [players[event.payload.playerToken]],
									cards: shuffle<WildCards | Territories, Card>(deck)
								};
								players[event.payload.playerToken].joined = games[commit.id];
							}
						}
						break;

					case 'GameClosed':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else {
							const game = Object.values(games).filter(game => getToken(game.host) === event.payload.playerToken);
							if (game.length <= 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Player ${players[event.payload.playerToken].name} is not hosting any game`));
							} else if (game.length > 1) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Player ${players[event.payload.playerToken].name} is hosting more than one game`));
							} else {
								games[game[0].token].status = Status.Deleted;
								for (const player of Object.values(players).filter(player => player.joined && (getToken(player.joined) === game[0].token))) {
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
						} else if (getToken(games[event.payload.gameToken].host) === event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Cannot join your own game`));
						} else if (games[event.payload.gameToken].round >= 0) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} already started`));
						} else if (players[event.payload.playerToken].joined) {
							messages.push(buildMessage(commit.id, MessageType.Error, `You already joined ${players[event.payload.playerToken].joined}`));
						} else if (Object.values(players).filter(player => getToken(player.joined) === event.payload.gameToken).length >= rules.MaxPlayerPerGame) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[event.payload.gameToken].name} already full`));
						} else {
							players[event.payload.playerToken].joined = games[event.payload.gameToken];
							games[event.payload.gameToken].players.push(players[event.payload.playerToken]);
						}
						break;

					case 'GameQuitted':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else {
							const joinedToken = getToken(players[event.payload.playerToken].joined);
							if (!joinedToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You are not in any game currently`));
							} else if (getToken(games[joinedToken].host) === event.payload.playerToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You cannot quit your own game`));
							} else {
								players[event.payload.playerToken].joined = undefined;
								games[joinedToken].players = games[joinedToken].players.filter(p => getToken(p) !== event.payload.playerToken);
							}
						}
						break;

					case 'GameStarted':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else if (!games[event.payload.gameToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Game ${event.payload.gameToken} not found`));
						} else if (getToken(games[event.payload.gameToken].host) !== event.payload.playerToken) {
							messages.push(buildMessage(commit.id, MessageType.Error, `You can only start your own game`));
						} else if (games[event.payload.gameToken].players.length < rules.MinPlayerPerGame) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Not enough players in the game ${games[event.payload.gameToken].name} yet`));
						} else {
							games[event.payload.gameToken].round = 0; // status not equal Status.Ready yet, that is after setup finished
						}
						break;

					case 'TerritoryAssigned':
						if (!players[event.payload.playerToken]) {
							messages.push(buildMessage(commit.id, MessageType.Error, `Player ${event.payload.playerToken} not found`));
						} else {
							const joinedToken = getToken(players[event.payload.playerToken].joined);
							if (!joinedToken) {
								messages.push(buildMessage(commit.id, MessageType.Error, `You are not in any game currently`));
							} else if (games[joinedToken].round < 0) {
								messages.push(buildMessage(commit.id, MessageType.Error, `Game ${games[joinedToken].name} not yet started`));
							} else {
								const player = players[event.payload.playerToken];
								const territory = map[event.payload.territoryName as Territories];
								if (!player.holdings) player.holdings = {};
								player.holdings[territory.name] = territory;
							}
						}
						break;

					case 'TerritorySelected':
						// TODO
						break;

					case 'TerritoryAttacked':
						// TODO
						break;

					case 'TerritoryConquered':
						// TODO
						break;

					case 'TerritoryFortified':
						// TODO
						break;

					case 'PlayerDefeated':
						// TODO
						break;

					case 'TroopPlaced':
						// TODO
						break;

					case 'TroopAdded':
						// TODO
						break;

					case 'TroopDeployed':
						// TODO
						break;

					case 'NextPlayer':
						// TODO
						break;

					case 'SetupFinished':
						// TODO
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
							const card = deck[event.payload.cardName as Territories | WildCards]
							const game = games[event.payload.gameToken];
							if (!game.cards) game.cards = [];
							game.cards.push(card);
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
			return { players, games, messages };
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
