import { Redis } from 'ioredis';
import { getSnapshot } from '../queries';
import { _shuffle, Territories, WildCards } from '../rules';
import {
	Commit, CommitStore, createCommit, getCommitStore,
	PlayerRegistered, PlayerLeft,
	GameOpened, GameClosed, GameJoined, GameQuitted, PlayerShuffled,
	GameStarted, TerritoryAssigned, MoveMade,
	// TerritoryAttacked, TerritoryFortified, TerritorySelected, TroopPlaced, TurnEnded,
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
};

export const getCommands = (channel: string, client: Redis) => {
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
		},
		// FinishSetup: (payload: { playerToken: string; gameToken: string }) =>
		// 	createCommit().addEvent<SetupFinished>({
		// 		type: 'SetupFinished',
		// 		payload
		// 	}).build(commitStore),
		MakeMove: (payload: { playerToken: string; gameToken: string; territoryName: string; flag: number }) =>
			createCommit().addEvent<MoveMade>({
				type: 'MoveMade',
				payload
			}).build(commitStore),
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