import { Commit, generateToken } from './commits';
import { buildMap, Errors, Game, Player, shuffleDeck } from './entities';
import { rules } from '.';

export const reducer = (
	commits: Commit[],
	initial?: {
		players: Record<string, Player>;
		games: Record<string, Game>;
		errors: Record<string, Errors>;
	}
) => {
	return commits.reduce(({ players, games, errors }, commit) => {
		for (const event of commit.events) {
			switch (event.type) {
				case 'PlayerRegistered':
					if (Object.values(players).filter(player => player.name === event.payload.playerName).length > 0) {
						errors[commit.id] = { event, message: `Player ${event.payload.playerName} already registered` }
					} else {
						players[commit.id] = {
							token: commit.id,
							name: event.payload.playerName,
							reinforcement: 0,
							cards: {},
							sessionid: generateToken(Date.now()),
							ready: false
						};
					}
					break;

				case 'PlayerLeft':
					if (!players[event.payload.playerToken]) {
						errors[commit.id] = { event, message: `Player ${event.payload.playerToken} not found` }
					} else {
						delete players[event.payload.playerToken];
					}
					break;

				case 'GameOpened':
					if (!players[event.payload.playerToken]) {
						errors[commit.id] = { event, message: `Player ${event.payload.playerToken} not found` }
					} else if (Object.values(games).filter(game => game.name === event.payload.gameName).length > 0) {
						errors[commit.id] = { event, message: `Game ${event.payload.gameName} already exists` }
					} else {
						games[commit.id] = {
							token: commit.id,
							name: event.payload.gameName,
							host: players[event.payload.playerToken],
							round: -1,
							redeemed: 0,
							cards: shuffleDeck(),
							map: buildMap()
						};
						players[event.payload.playerToken].joined = games[commit.id];
					}
					break;

				case 'GameClosed':
					if (!players[event.payload.playerToken]) {
						errors[commit.id] = { event, message: `Player ${event.payload.playerToken} not found` }
					} else {
						const game = Object.values(games).filter(game => game.host.token === event.payload.playerToken);
						if (game.length <= 0) {
							errors[commit.id] = { event, message: `Player ${players[event.payload.playerToken].name} is not hosting any game` }
						} else if (game.length > 1) {
							errors[commit.id] = { event, message: `Player ${players[event.payload.playerToken].name} is hosting more than one game` }
						} else {
							delete games[game[0].token];
							for (const player of Object.values(players).filter(player => player.joined && (player.joined.token === game[0].token))) {
								player.joined = undefined;
							}
						}
					}
					break;

				case 'GameJoined':
					if (!players[event.payload.playerToken]) {
						errors[commit.id] = { event, message: `Player ${event.payload.playerToken} not found` }
					} else if (!games[event.payload.gameToken]) {
						errors[commit.id] = { event, message: `Game ${event.payload.gameToken} not found` }
					} else if (games[event.payload.gameToken].host.token === event.payload.playerToken) {
						errors[commit.id] = { event, message: `Cannot join your own game` }
					} else if (games[event.payload.gameToken].round >= 0) {
						errors[commit.id] = { event, message: `Game ${games[event.payload.gameToken].name} already started` }
					} else if (players[event.payload.playerToken].joined) {
						errors[commit.id] = { event, message: `You already joined ${players[event.payload.playerToken].joined?.name}` }
					} else if (Object.values(players).filter(player => player.joined?.token === event.payload.gameToken).length >= rules.MaxPlayerPerGame) {
						errors[commit.id] = { event, message: `Game ${games[event.payload.gameToken].name} already full` }
					} else {
						players[event.payload.playerToken].joined = games[event.payload.gameToken];
					}
					break;

				case 'GameQuitted':
					if (!players[event.payload.playerToken]) {
						errors[commit.id] = { event, message: `Player ${event.payload.playerToken} not found` }
					} else if (!players[event.payload.playerToken].joined) {
						errors[commit.id] = { event, message: `You are not in any game currently` }
					} else if (players[event.payload.playerToken].joined?.token === event.payload.playerToken) {
						errors[commit.id] = { event, message: `You cannot quit your own game` }
					} else {
						players[event.payload.playerToken].joined = undefined;
					}
					break;

				case 'GameStarted':
					// TODO
					break;

				case 'TerritoryAssigned':
					// TODO
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
					// TODO
					break;

				case 'CardsRedeemed':
					// TODO
					break;

				case 'GameWon':
					// TODO
					break;
			}
		}
		return { players, games, errors };
	}, initial ? initial : {
		players: {},
		games: {},
		errors: {}
	});
};
