import { shuffleDeck } from '../rules';
import {
	BaseEvent, Commit, generateToken, PlayerRegistered, PlayerLeft,
	GameOpened, GameClosed, GameJoined, GameQuitted, GameStarted,
	TerritoryAssigned, TerritorySelected, TerritoryAttacked, TerritoryConquered,
	TerritoryFortified, PlayerDefeated, TroopPlaced, NextPlayer,
	SetupFinished, TurnEnded, CardReturned, CardsRedeemed, GameWon
} from '.';

const createCommit = () => {
	const commit: Commit = {
		id: generateToken(Date.now()),
		version: 0,
		events: []
	};

	const build = (): Commit => {
		if (commit.events.length < 1)  throw new Error('createCommit Invalid parameter(s)');
		return commit;
	}

	const addEvent = <E extends BaseEvent>(event: E) => {
		commit.events.push(event);
		return {
			build,
			addEvent
		};
	}

	return { addEvent };
};

export const Commands = {
	RegisterPlayer: (payload: { playerName: string }) =>
		createCommit().addEvent<PlayerRegistered>({
			type: 'PlayerRegistered',
			payload
		}).build(),
	PlayerLeave: (payload: { playerToken: string }) =>
		createCommit().addEvent<PlayerLeft>({
			type: 'PlayerLeft',
			payload
		}).build(),
	OpenGame: (payload: { playerToken: string; gameName: string }) =>
		createCommit().addEvent<GameOpened>({
			type: 'GameOpened',
			payload
		}).build(),
	CloseGame: (payload: { playerToken: string; gameToken: string }) =>
		createCommit().addEvent<GameClosed>({
			type: 'GameClosed',
			payload
		}).build(),
	JoinGame: (payload: { playerToken: string; gameToken: string }) =>
		createCommit().addEvent<GameJoined>({
			type: 'GameJoined',
			payload
		}).build(),
	QuitGame: (payload: { playerToken: string; gameToken: string }) =>
		createCommit().addEvent<GameQuitted>({
			type: 'GameQuitted',
			payload
		}).build(),
	StartGame: (payload: { playerToken: string; gameToken: string }) => {
		const { build, addEvent } = createCommit().addEvent<GameStarted>({
			type: 'GameStarted',
			payload
		});
		for (const card of shuffleDeck()) { // Need to do it here because need to record each card in a event, otherwise cannot replay
			addEvent<CardReturned>({
				type: 'CardReturned',
				payload: { gameToken: payload.gameToken, cardName: card.name }
			});
		}
		return build();
	},
	AssignTerritory: (payload: { playerToken: string; gameToken: string; territoryName: string }) =>
		createCommit().addEvent<TerritoryAssigned>({
			type: 'TerritoryAssigned',
			payload
		}).build(),
	SelectTerritory: (payload: { playerToken: string; gameToken: string; territoryName: string }) =>
		createCommit().addEvent<TerritorySelected>({
			type: 'TerritorySelected',
			payload
		}).build(),
	AttackTerritory: (payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		attackerLoss: number;
		defenderLoss: number;
	}) =>
		createCommit().addEvent<TerritoryAttacked>({
			type: 'TerritoryAttacked',
			payload
		}).build(),
	ConquerTerritory: (payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
	}) =>
		createCommit().addEvent<TerritoryConquered>({
			type: 'TerritoryConquered',
			payload
		}).build(),
	Fortify: (payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		amount: number;
	}) =>
		createCommit().addEvent<TerritoryFortified>({
			type: 'TerritoryFortified',
			payload
		}).build(),
	DefeatPlayer: (payload: { fromPlayer: string; toPlayer: string; gameToken: string }) =>
		createCommit().addEvent<PlayerDefeated>({
			type: 'PlayerDefeated',
			payload
		}).build(),
	PlaceTroop: (payload: { playerToken: string; gameToken: string; territoryName: string; amount?: number }) => {
		if (!payload.amount) payload.amount = 1;
		return createCommit().addEvent<TroopPlaced>({
			type: 'TroopPlaced',
			payload
		}).build();
	},
	NextPlayer: (payload: { fromPlayer: string; toPlayer: string; gameToken: string }) =>
		createCommit().addEvent<NextPlayer>({
			type: 'NextPlayer',
			payload
		}).build(),
	FinishSetup: (payload: { playerToken: string; gameToken: string }) =>
		createCommit().addEvent<SetupFinished>({
			type: 'SetupFinished',
			payload
		}).build(),
	EndTurn: (payload: { playerToken: string; gameToken: string }) =>
		createCommit().addEvent<TurnEnded>({
			type: 'TurnEnded',
			payload
		}).build(),
	RedeemCards: (payload: { playerToken: string; gameToken: string; cardNames: string[] }) => {
		const { build, addEvent } = createCommit().addEvent<CardsRedeemed>({
			type: 'CardsRedeemed',
			payload
		});
		for (const card of payload.cardNames) {
			addEvent<CardReturned>({
				type: 'CardReturned',
				payload: { gameToken: payload.gameToken, cardName: card }
			});
		}
		return build();
	},
	WinGame: (payload: { playerToken: string; gameToken: string }) =>
		createCommit().addEvent<GameWon>({
			type: 'GameWon',
			payload
		}).build(),
};
