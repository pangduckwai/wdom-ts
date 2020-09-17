import { Redis } from 'ioredis';
import { getSnapshot } from '../queries';
import { _shuffle, rules, Card, Continent, Continents, Territories, Territory, WildCards, getValidator, GameStage, Expected } from '../rules';
import { FLAG_SHIFT, FLAG_ALT } from '..';
import {
	Commit, CommitStore, createCommit, getCommitStore,
	PlayerRegistered, PlayerLeft,
	GameOpened, GameClosed, GameJoined, GameQuitted,
	PlayerShuffled, GameStarted, TerritoryAssigned,
	TerritorySelected, TroopPlaced, // TerritoryAttacked, TerritoryFortified, TurnEnded,
	CardReturned,
	// CardsRedeemed, PlayerDefeated, GameWon
} from '.';

export type Commands = {
	RegisterPlayer: (payload: { playerName: string }) => Promise<Commit>,
	PlayerLeave: (payload: { playerToken: string }) => Promise<Commit>,
	OpenGame: (payload: { playerToken: string; gameName: string }) => Promise<Commit>,
	CloseGame: (payload: { playerToken: string }) => Promise<Commit>,
	JoinGame: (payload: { playerToken: string; gameToken: string }) => Promise<Commit>,
	QuitGame: (payload: { playerToken: string }) => Promise<Commit>,
	StartGame: (payload: { playerToken: string; gameToken: string }) => Promise<Commit>,
	MakeMove: (payload: { playerToken: string; gameToken: string; territoryName: string; flag: number }) => Promise<Commit>,
};

export const getCommands = (
	channel: string,
	client: Redis,
	world: Record<Continents, Continent>,
	map: Record<Territories, Territory>,
	deck: Record<WildCards | Territories, Card>
): Commands => {
	const validator = getValidator(map, deck);
	const commitStore: CommitStore = getCommitStore(channel, client);
	const snapshot = getSnapshot(channel, client);

	return {
		RegisterPlayer: (payload: { playerName: string }) =>
			createCommit().addEvent<PlayerRegistered>({
				type: 'PlayerRegistered',
				payload
			}).build(commitStore),
		PlayerLeave: (payload: { playerToken: string }) =>
			createCommit().addEvent<PlayerLeft>({
				type: 'PlayerLeft',
				payload
			}).build(commitStore),
		OpenGame: (payload: { playerToken: string; gameName: string }) =>
			createCommit().addEvent<GameOpened>({
				type: 'GameOpened',
				payload
			}).build(commitStore),
		CloseGame: (payload: { playerToken: string }) =>
			createCommit().addEvent<GameClosed>({
				type: 'GameClosed',
				payload
			}).build(commitStore),
		JoinGame: (payload: { playerToken: string; gameToken: string }) =>
			createCommit().addEvent<GameJoined>({
				type: 'GameJoined',
				payload
			}).build(commitStore),
		QuitGame: (payload: { playerToken: string }) =>
			createCommit().addEvent<GameQuitted>({
				type: 'GameQuitted',
				payload
			}).build(commitStore),
		StartGame: async (payload: { playerToken: string; gameToken: string }) => {
			const { players, games } = await snapshot.read();
			const error = validator(players, games)({
				playerToken: payload.playerToken,
				hostToken: payload.playerToken,
				gameToken: payload.gameToken,
				expectedStage: { expected: Expected.OnOrBefore, stage: GameStage.GameOpened }
			});
			if (!error) {
				if (games[payload.gameToken].players.length < rules.MinPlayerPerGame) {
					return new Promise<Commit>((_, reject) => {
						reject(new Error(`[commands.StartGame] Not enough players in the game "${games[payload.gameToken].name}" yet`));
					});
				} else {
					const tokens: string[] = _shuffle(games[payload.gameToken].players);
					// Need to do these here because need to record player orders, territory assigned, and cards, in a event, otherwise cannot replay
					const { build, addEvent } = createCommit().addEvent<PlayerShuffled>({
						type: 'PlayerShuffled',
						payload: {
							...payload,
							players: tokens
						}
					});
					for (const territoryName of _shuffle(Territories.map(t => t))) {
						addEvent<TerritoryAssigned>({
							type: 'TerritoryAssigned',
							payload: { ...payload, territoryName }
						});
					}
					for (const cardName of _shuffle([...WildCards, ...Territories])) {
						addEvent<CardReturned>({
							type: 'CardReturned',
							payload: { ...payload, cardName }
						});
					}
					addEvent<GameStarted>({
						type: 'GameStarted',
						payload
					});
					return build(commitStore);
				}
			} else {
				return new Promise<Commit>((_, reject) => {
					reject(new Error(`[commands.StartGame] ${error}`));
				});
			}
		},
		MakeMove: async ({
			playerToken, gameToken, territoryName, flag
		}: {
			playerToken: string; gameToken: string; territoryName: string; flag: number
		}) => {
			const { players, games } = await snapshot.read();
			const error = validator(players, games)({
				playerToken,
				hostToken: playerToken,
				gameToken,
				territory: territoryName,
				expectedStage: { expected: Expected.OnOrAfter, stage: GameStage.GameStarted }
			});
			if (!error) {
				const player = players[playerToken];
				const game = games[gameToken];
				const { build, addEvent } = createCommit().addEvent<TerritorySelected>({
					type: 'TerritorySelected',
					payload: { playerToken, gameToken, territoryName }
				});
				if (Object.keys(player.holdings).filter(t => t === territoryName).length > 0) {
					// Clicking on the player's own territory
					if (game.round === 0) {
						// setup phase // if (game.players.filter(p => players[p].reinforcement > 0).length > 0) {
						if (player.reinforcement > 0) {
							const flagAll = (flag & FLAG_ALT) > 0; // place all remaining troops at once
							const flagDdc = (flag & FLAG_SHIFT) > 0; // subtract troop
							addEvent<TroopPlaced>({
								type: 'TroopPlaced',
								payload: {
									playerToken, gameToken, territoryName,
									amount: (flagAll) ? player.reinforcement : (flagDdc) ? -1 : 1
								}
							});
						}
					}
				}
				return build(commitStore);
			} else {
				return new Promise<Commit>((_, reject) => {
					reject(new Error(`[commands.MakeMove] ${error}`));
				});
			}
		},
		// FinishSetup: (payload: { playerToken: string; gameToken: string }) =>
		// 	createCommit().addEvent<SetupFinished>({
		// 		type: 'SetupFinished',
		// 		payload
		// 	}).build(commitStore),
		// PlaceTroop: (payload: { playerToken: string; gameToken: string; territoryName: string; amount: number }) => {
		// 	return createCommit().addEvent<TroopPlaced>({
		// 		type: 'TroopPlaced',
		// 		payload
		// 	}).addEvent<TerritorySelected>({
		// 		type: 'TerritorySelected',
		// 		payload: {
		// 			playerToken: payload.playerToken,
		// 			gameToken: payload.gameToken,
		// 			territoryName: payload.territoryName
		// 		}
		// 	}).build(commitStore);
		// },
		// AttackTerritory: (payload: {
		// 	fromPlayer: string;
		// 	toPlayer: string;
		// 	gameToken: string;
		// 	fromTerritory: string;
		// 	toTerritory: string;
		// 	attackerLoss: number;
		// 	defenderLoss: number;
		// }) =>
		// 	createCommit().addEvent<TerritoryAttacked>({
		// 		type: 'TerritoryAttacked',
		// 		payload
		// 	}).addEvent<TerritorySelected>({
		// 		type: 'TerritorySelected',
		// 		payload: {
		// 			playerToken: payload.fromPlayer,
		// 			gameToken: payload.gameToken,
		// 			territoryName: payload.toTerritory
		// 		}
		// 	}).build(commitStore),
		// ConquerTerritory: (payload: {
		// 	fromPlayer: string;
		// 	toPlayer: string;
		// 	gameToken: string;
		// 	fromTerritory: string;
		// 	toTerritory: string;
		// }) =>
		// 	createCommit().addEvent<TerritoryConquered>({
		// 		type: 'TerritoryConquered',
		// 		payload
		// 	}).build(commitStore),
		// Fortify: (payload: {
		// 	playerToken: string;
		// 	gameToken: string;
		// 	fromTerritory: string;
		// 	toTerritory: string;
		// 	amount: number;
		// }) =>
		// 	createCommit().addEvent<TerritoryFortified>({
		// 		type: 'TerritoryFortified',
		// 		payload
		// 	}).build(commitStore),
		// DefeatPlayer: (payload: { fromPlayer: string; toPlayer: string; gameToken: string }) =>
		// 	createCommit().addEvent<PlayerDefeated>({
		// 		type: 'PlayerDefeated',
		// 		payload
		// 	}).build(commitStore),
		// EndTurn: (payload: { playerToken: string; gameToken: string }) =>
		// 	createCommit().addEvent<TurnEnded>({
		// 		type: 'TurnEnded',
		// 		payload
		// 	}).build(commitStore),
		// RedeemCards: (payload: { playerToken: string; gameToken: string; cardNames: string[] }) => {
		// 	const { build, addEvent } = createCommit().addEvent<CardsRedeemed>({
		// 		type: 'CardsRedeemed',
		// 		payload
		// 	});
		// 	for (const card of payload.cardNames) {
		// 		addEvent<CardReturned>({
		// 			type: 'CardReturned',
		// 			payload: { playerToken: payload.playerToken, gameToken: payload.gameToken, cardName: card }
		// 		});
		// 	}
		// 	return build(commitStore);
		// },
		// WinGame: (payload: { playerToken: string; gameToken: string }) =>
		// 	createCommit().addEvent<GameWon>({
		// 		type: 'GameWon',
		// 		payload
		// 	}).build(commitStore),
		// NextPlayer: (payload: { fromPlayer: string; toPlayer: string; gameToken: string }) =>
		// 	createCommit().addEvent<NextPlayer>({
		// 		type: 'NextPlayer',
		// 		payload
		// 	}).build(commitStore),
	};
};