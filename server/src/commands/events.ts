import { RuleTypes, Territories, WildCards } from "../rules";

export interface BaseEvent {
	readonly type: string;
	payload: any;
}

// ************************
// *** Game room Events ***
export interface PlayerRegistered extends BaseEvent {
	readonly type: 'PlayerRegistered';
	payload: {
		playerName: string;
	}
}

export interface PlayerLeft extends BaseEvent {
	readonly type: 'PlayerLeft';
	payload: {
		playerToken: string;
	}
}

export interface GameOpened extends BaseEvent {
	readonly type: 'GameOpened';
	payload: {
		playerToken: string;
		gameName: string;
		ruleType: RuleTypes;
	}
}

export interface GameClosed extends BaseEvent {
	readonly type: 'GameClosed';
	payload: {
		playerToken: string;
	}
}

export interface GameJoined extends BaseEvent {
	readonly type: 'GameJoined';
	payload: {
		playerToken: string;
		gameToken: string;
	}
}

export interface GameQuitted extends BaseEvent {
	readonly type: 'GameQuitted';
	payload: {
		playerToken: string;
	}
}

export interface PlayerShuffled extends BaseEvent {
	readonly type: 'PlayerShuffled';
	payload: {
		playerToken: string;
		gameToken: string;
		players: string[];
	}
}

export interface TerritoryAssigned extends BaseEvent {
	readonly type: 'TerritoryAssigned';
	payload: {
		playerToken: string; // NOTE: this is the host's token starting a game (and assigning territories)
		gameToken: string;
		territory: Territories;
	}
}

export interface GameStarted extends BaseEvent {
	readonly type: 'GameStarted';
	payload: {
		playerToken: string;
		gameToken: string;
	}
}
// ************************

// *******************************
// *** MakeMove derived events ***
export interface TerritorySelected extends BaseEvent {
	readonly type: 'TerritorySelected';
	payload: {
		playerToken: string;
		gameToken: string;
		territory: Territories;
	}
}

/** TroopPlaced - place troop(s) during setup and at the begining of each turn */
export interface TroopPlaced extends BaseEvent {
	readonly type: 'TroopPlaced';
	payload: {
		playerToken: string;
		gameToken: string;
		territory: Territories;
		amount: number;
	}
}

export interface TerritoryAttacked extends BaseEvent {
	readonly type: 'TerritoryAttacked';
	payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
		fromTerritory: Territories;
		toTerritory: Territories;
		redDice: number[];
		whiteDice: number[];
		attackerLoss: number;
		defenderLoss: number;
	}
}
// *******************************

// ************************
// *** Game play events ***
export interface TurnEnded extends BaseEvent {
	readonly type: 'TurnEnded';
	payload: {
		playerToken: string;
		gameToken: string;
	}
}

export interface PositionFortified extends BaseEvent {
	readonly type: 'PositionFortified';
	payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: Territories;
		toTerritory: Territories;
		amount: number;
	}
}
// ************************

// ********************
// *** Cards events ***
/** Put card(s) back to the deck */
export interface CardReturned extends BaseEvent {
	readonly type: 'CardReturned';
	payload: {
		playerToken: string;
		gameToken: string;
		card: WildCards | Territories;
	}
}

export interface CardsRedeemed extends BaseEvent {
	readonly type: 'CardsRedeemed';
	payload: {
		playerToken: string;
		gameToken: string;
		cards: (WildCards | Territories)[];
	}
}
// ********************

export type Events =
	PlayerRegistered | PlayerLeft | GameOpened | GameClosed | GameJoined | GameQuitted | GameStarted |
	TerritoryAssigned | TerritorySelected | TerritoryAttacked | PositionFortified | PlayerShuffled |
	TroopPlaced | TurnEnded | CardReturned | CardsRedeemed
;
