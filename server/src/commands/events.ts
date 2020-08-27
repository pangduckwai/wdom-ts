
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
// ************************

// ************************
// *** Game play Events ***
export interface PlayerShuffled extends BaseEvent {
	readonly type: 'PlayerShuffled';
	payload: {
		playerToken: string;
		gameToken: string;
		players: string[];
	}
}

export interface GameStarted extends BaseEvent {
	readonly type: 'GameStarted';
	payload: {
		playerToken: string;
		gameToken: string;
	}
}

// export interface SetupBegun extends BaseEvent {
// 	readonly type: 'SetupBegun';
// 	payload: {
// 		gameToken: string;
// 	}
// }

// export interface SetupFinished extends BaseEvent {
// 	readonly type: 'SetupFinished';
// 	payload: {
// 		gameToken: string;
// 	}
// }

export interface TerritoryAssigned extends BaseEvent {
	readonly type: 'TerritoryAssigned';
	payload: {
		gameToken: string;
		territoryName: string;
	}
}

// export interface ReinforcementArrived extends BaseEvent {
// 	readonly type: 'ReinforcementArrived';
// 	payload: {
// 		playerToken?: string;
// 		gameToken: string;
// 	}
// }

// export interface MoveMade extends BaseEvent {
// 	readonly type: 'MoveMade';
// 	payload: {
// 		playerToken: string;
// 		gameToken: string;
// 		territoryName: string;
// 		flag: number;
// 	}
// }

export interface TerritorySelected extends BaseEvent {
	readonly type: 'TerritorySelected';
	payload: {
		playerToken: string;
		gameToken: string;
		territoryName: string;
	}
}

/** Placing troops on map (both during game setup and add reinforcement at start of turns */
	export interface TroopPlaced extends BaseEvent {
		readonly type: 'TroopPlaced';
		payload: {
			playerToken: string;
			gameToken: string;
			territoryName: string;
			amount: number;
		}
	}
	
/** fromPlayer is the attacker, toPlayer is the defender */
export interface TerritoryAttacked extends BaseEvent {
	readonly type: 'TerritoryAttacked';
	payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		attackerLoss: number;
		defenderLoss: number;
	}
}

// /** fromPlayer is the conquerer, toPlayer is the original owner */
// export interface TerritoryConquered extends BaseEvent {
// 	readonly type: 'TerritoryConquered';
// 	payload: {
// 		fromPlayer: string;
// 		toPlayer: string;
// 		gameToken: string;
// 		fromTerritory: string;
// 		toTerritory: string;
// 	}
// }

export interface TerritoryFortified extends BaseEvent {
	readonly type: 'TerritoryFortified';
	payload: {
		playerToken: string;
		gameToken: string;
		fromTerritory: string;
		toTerritory: string;
		amount: number;
	}
}

/** fromPlayer is the conquerer, toPlayer is the one who got defeated */
export interface PlayerDefeated extends BaseEvent {
	readonly type: 'PlayerDefeated';
	payload: {
		fromPlayer: string;
		toPlayer: string;
		gameToken: string;
	}
}

// /** Placing reinforcement during reinforcement stage */
// export interface TroopAdded extends BaseEvent {
// 	readonly type: 'TroopAdded';
// 	payload: {
// 		playerToken: string;
// 		gameToken: string;
// 		territoryName: string;
// 	}
// }

// /** TODO: Should marking number of troops of a player an event of its own, or should be deduced? */
// export interface TroopDeployed extends BaseEvent {
// 	readonly type: 'TroopDeployed';
// 	payload: {
// 		playerToken: string;
// 		gameToken: string;
// 		amount: number;
// 	}
// }

export interface TurnEnded extends BaseEvent {
	readonly type: 'TurnEnded';
	payload: {
		playerToken: string;
		gameToken: string;
	}
}

/** Card put back to the deck */
export interface CardReturned extends BaseEvent {
	readonly type: 'CardReturned';
	payload: {
		gameToken: string;
		cardName: string;
	}
}

export interface CardsRedeemed extends BaseEvent {
	readonly type: 'CardsRedeemed';
	payload: {
		playerToken: string;
		gameToken: string;
		cardNames: string[];
	}
}

export interface GameWon extends BaseEvent {
	readonly type: 'GameWon';
	payload: {
		playerToken: string;
		gameToken: string;
	}
}
// ************************

// export type Events =
// 	PlayerRegistered | PlayerLeft | GameOpened | GameClosed | GameJoined | GameQuitted | GameStarted |
// 	TerritoryAssigned | TerritorySelected | TerritoryAttacked | TerritoryConquered | TerritoryFortified |
// 	PlayerDefeated | TroopPlaced | TroopAdded | TroopDeployed | NextPlayer | SetupFinished | TurnEnded |
// 	CardReturned | CardsRedeemed | GameWon
// ;
