import {
	BaseEvent, Commit, generateToken, PlayerRegistered, PlayerLeft,
	GameOpened, GameClosed, GameJoined, GameQuitted, GameStarted,
	TerritoryAssigned, TerritorySelected, TerritoryAttacked, TerritoryConquered,
	TerritoryFortified, PlayerDefeated, TroopPlaced, TroopAdded, NextPlayer,
	SetupFinished, TurnEnded, CardReturned, CardsRedeemed, GameWon
} from '.';

const buildCommit = <E extends BaseEvent>(events: E[]) => {
	if (!events || (events.length < 1)) throw new Error('[buildCommit] Invalid parameter(s)');
	const stamp = Date.now()
	return {
		id: generateToken(stamp),
		timestamp: stamp,
		version: 0,
		events,
	}
};

export const Commands = {
	RegisterPlayer: async (payload: { playerName: string }) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<PlayerRegistered>([{
				type: 'PlayerRegistered',
				payload
			}]));
		}),
	PlayerLeave: async (payload: { playerToken: string }) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<PlayerLeft>([{
				type: 'PlayerLeft',
				payload
			}]));
		}),
	OpenGame: async (payload: {
		playerToken: string;
		gameName: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<GameOpened>([{
				type: 'GameOpened',
				payload
			}]));
		}),
	CloseGame: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<GameClosed>([{
				type: 'GameClosed',
				payload
			}]));
		}),
	JoinGame: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<GameJoined>([{
				type: 'GameJoined',
				payload
			}]));
		}),
	QuitGame: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<GameQuitted>([{
				type: 'GameQuitted',
				payload
			}]));
		}),
	StartGame: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<GameStarted>([{
				type: 'GameStarted',
				payload
			}]));
		}),
	AssignTerritory: async (payload: {
		playerToken: string;
		gameToken: string;
		territoryName: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TerritoryAssigned>([{
				type: 'TerritoryAssigned',
				payload
			}]));
		}),
	SelectTerritory: async (payload: {
		playerToken: string;
		gameToken: string;
		territoryName: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TerritorySelected>([{
				type: 'TerritorySelected',
				payload
			}]));
		}),
	AttackTerritory: async (payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		attackerLoss: number;
		defenderLoss: number;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TerritoryAttacked>([{
				type: 'TerritoryAttacked',
				payload
			}]));
		}),
	ConquerTerritory: async (payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TerritoryConquered>([{
				type: 'TerritoryConquered',
				payload
			}]));
		}),
	Fortify: async (payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		amount: number;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TerritoryFortified>([{
				type: 'TerritoryFortified',
				payload
			}]));
		}),
	DefeatPlayer: async (payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<PlayerDefeated>([{
				type: 'PlayerDefeated',
				payload
			}]));
		}),
	PlaceTroop: async (payload: {
		playerToken: string;
		gameToken: string;
		territoryName: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TroopPlaced>([{
				type: 'TroopPlaced',
				payload
			}]));
		}),
	AddTroop: async (payload: {
		playerToken: string;
		gameToken: string;
		territoryName: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TroopAdded>([{
				type: 'TroopAdded',
				payload
			}]));
		}),
	NextPlayer: async (payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<NextPlayer>([{
				type: 'NextPlayer',
				payload
			}]));
		}),
	FinishSetup: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<SetupFinished>([{
				type: 'SetupFinished',
				payload
			}]));
		}),
	EndTurn: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<TurnEnded>([{
				type: 'TurnEnded',
				payload
			}]));
		}),
	ReturnCard: async (payload: {
		playerToken: string;
		gameToken: string;
		cardName: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<CardReturned>([{
				type: 'CardReturned',
				payload
			}]));
		}),
	RedeemCards: async (payload: {
		playerToken: string;
		gameToken: string;
		cardNames: string[];
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<CardsRedeemed>([{
				type: 'CardsRedeemed',
				payload
			}]));
		}),
	WinGame: async (payload: {
		playerToken: string;
		gameToken: string;
	}) =>
		new Promise<Commit>((resolve, _) => {
			resolve(buildCommit<GameWon>([{
				type: 'GameWon',
				payload
			}]));
		}),
};
