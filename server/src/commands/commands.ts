import {
	BaseEvent, Commit, generateToken, PlayerRegistered, PlayerLeft,
	GameOpened, GameClosed, GameJoined, GameQuitted, GameStarted,
	TerritoryAssigned, TerritorySelected, TerritoryAttacked, TerritoryConquered,
	TerritoryFortified, PlayerDefeated, TroopPlaced, TroopAdded, NextPlayer,
	SetupFinished, TurnEnded, CardReturned, CardsRedeemed, GameWon
} from '.';

const buildCommit = <E extends BaseEvent>(events: E[]): Commit => {
	if (!events || (events.length < 1)) throw new Error('[buildCommit] Invalid parameter(s)');
	const stamp = Date.now()
	return {
		id: generateToken(stamp),
		version: 0,
		events,
	}
};

export const Commands = {
	RegisterPlayer: (payload: { playerName: string }) =>
		buildCommit<PlayerRegistered>([{
			type: 'PlayerRegistered',
			payload
		}]),
	PlayerLeave: (payload: { playerToken: string }) =>
		buildCommit<PlayerLeft>([{
			type: 'PlayerLeft',
			payload
		}]),
	OpenGame: (payload: { playerToken: string; gameName: string }) =>
		buildCommit<GameOpened>([{
			type: 'GameOpened',
			payload
		}]),
	CloseGame: (payload: { playerToken: string }) =>
		buildCommit<GameClosed>([{
			type: 'GameClosed',
			payload
		}]),
	JoinGame: (payload: { playerToken: string; gameToken: string }) =>
		buildCommit<GameJoined>([{
			type: 'GameJoined',
			payload
		}]),
	QuitGame: (payload: { playerToken: string }) =>
		buildCommit<GameQuitted>([{
			type: 'GameQuitted',
			payload
		}]),
	StartGame: (payload: { playerToken: string }) =>
		buildCommit<GameStarted>([{
			type: 'GameStarted',
			payload
		}]),
	AssignTerritory: (payload: { playerToken: string; gameToken: string; territoryName: string }) =>
		buildCommit<TerritoryAssigned>([{
			type: 'TerritoryAssigned',
			payload
		}]),
	SelectTerritory: (payload: { playerToken: string; gameToken: string; territoryName: string }) =>
		buildCommit<TerritorySelected>([{
			type: 'TerritorySelected',
			payload
		}]),
	AttackTerritory: (payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		attackerLoss: number;
		defenderLoss: number;
	}) =>
		buildCommit<TerritoryAttacked>([{
			type: 'TerritoryAttacked',
			payload
		}]),
	ConquerTerritory: (payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
	}) =>
		buildCommit<TerritoryConquered>([{
			type: 'TerritoryConquered',
			payload
		}]),
	Fortify: (payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		amount: number;
	}) =>
		buildCommit<TerritoryFortified>([{
			type: 'TerritoryFortified',
			payload
		}]),
	DefeatPlayer: (payload: { fromPlayer: string; toPlayer: string; gameToken: string }) =>
		buildCommit<PlayerDefeated>([{
			type: 'PlayerDefeated',
			payload
		}]),
	PlaceTroop: (payload: { playerToken: string; gameToken: string; territoryName: string }) =>
		buildCommit<TroopPlaced>([{
			type: 'TroopPlaced',
			payload
		}]),
	AddTroop: (payload: { playerToken: string; gameToken: string; territoryName: string }) =>
		buildCommit<TroopAdded>([{
			type: 'TroopAdded',
			payload
		}]),
	NextPlayer: (payload: { fromPlayer: string; toPlayer: string; gameToken: string }) =>
		buildCommit<NextPlayer>([{
			type: 'NextPlayer',
			payload
		}]),
	FinishSetup: (payload: { playerToken: string; gameToken: string }) =>
		buildCommit<SetupFinished>([{
			type: 'SetupFinished',
			payload
		}]),
	EndTurn: (payload: { playerToken: string; gameToken: string }) =>
		buildCommit<TurnEnded>([{
			type: 'TurnEnded',
			payload
		}]),
	ReturnCard: (payload: { playerToken: string; gameToken: string; cardName: string }) =>
		buildCommit<CardReturned>([{
			type: 'CardReturned',
			payload
		}]),
	RedeemCards: (payload: { playerToken: string; gameToken: string; cardNames: string[] }) =>
		buildCommit<CardsRedeemed>([{
			type: 'CardsRedeemed',
			payload
		}]),
	WinGame: (payload: { playerToken: string; gameToken: string }) =>
		buildCommit<GameWon>([{
			type: 'GameWon',
			payload
		}]),
};
