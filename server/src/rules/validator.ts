import { rules, Card, Game, Player, _shuffle, Territories, WildCards, Territory } from '.';
import { Status } from '..';

/**
 * The stages are Opened (-2), Started (-1), GameSetup (0), TurnSetup (>0), GamePlay(>0), the 'before' and 'after' modifiers are for
 * the different error messages, they are inclusive (e.g. BeforeStarted and AfterStarted both expect round also equal -1, just give differnet
 * error message)
 */
export enum GameStage {
	/** round =-1; Waiting for other players to join, go to next stage by host's action */
	GameOpened,
	/** round = 0 total reinforcement > 0; Waiting for players to deploy all troops, check after
	 *  every move, automatically go to next stage (round += 1) once total reinforcement == 0 */
	GameStarted,
	/** round > 0; Waiting for player to finish the turn, go to GameInProgress
	 * stage of the next player in line */
	GameInProgress
};

export enum Expected {
	Before, OnOrBefore, OnOrAfter, After // both inclusive
}

/** Main validator */
export const getValidator = (
	map: Record<Territories, Territory>,
	deck: Record<Territories | WildCards, Card>,
) => {
	return (
		players: Record<string, Player>,
		games: Record<string, Game>,
	) => {
		return ({
			playerToken, playerToken2, hostToken, gameToken, territory, territory2, card, cards, expectedStage
		}: {
			playerToken?: string;
			playerToken2?: string;
			hostToken?: string;
			gameToken?: string;
			territory?: string;
			territory2?: string;
			card?: string;
			cards?: string[];
			expectedStage?: { expected: Expected, stage: GameStage; };
		}) => {
			if (playerToken && !players[playerToken]) return `Player "${playerToken}" not found`;
			if (playerToken2 && !players[playerToken2]) return `Player "${playerToken2}" not found`;
			if (hostToken && !players[hostToken]) return `Player "${hostToken}" not found`;
			if (territory && !map[territory as Territories]) return `Unknown territory "${territory}"`;
			if (territory2 && !map[territory2 as Territories]) return `Unknown territory "${territory2}"`;
			if (territory && territory2) {
				if (!map[territory as Territories].connected.has(territory2 as Territories))
					return `Territories "${territory}" and "${territory2}" are not connected`;
			}

			if (card) {
				if (!deck[card as (WildCards | Territories)]) return `Invalid card "${card}"`;
			}

			const player = playerToken ? players[playerToken] : null;
			if (cards) {
				if (cards.length !== 3) return `${player ? `[${player.name}] p` : 'P'}lease redeem a set of 3 cards`;
				for (const c of cards) {
					if (!deck[c as (WildCards | Territories)]) return `Invalid card "${c}"`;
					if (player) {
						if (!player.cards[c]) return `[${player.name}] does not own the "${c}" card`;
					}
				}
				if (!rules.isRedeemable(cards.map(c => deck[c as (WildCards | Territories)])))
					return `Cards ${JSON.stringify(cards)} is not a redeemable set`;
			}

			if (gameToken) {
				const game = games[gameToken];
				if (!game) return `Game "${gameToken}" not found`;

				if (game.status === Status.Deleted)
					return `Game "${game.name}" already closed`;
				else if (game.status === Status.Finished)
					return `Game "${game.name}" already finished`;

				if ((hostToken) && (game.host !== hostToken))
					return `[${players[hostToken].name}] is not the host of game "${game.name}"`;

				if (player) {
					if (game.round >= 0) {
						// Players already join games
						if (game.players.filter(k => k === playerToken).length <= 0)
							return `["${player.name}] not found in game "${game.name}"`;
						if (!player.joined || (player.joined !== gameToken))
							return `[${player.name}] not in game "${game.name}"`;
						if (game.players[game.turns] !== playerToken)
							return `It is not the turn of player "${player.name}"`;
					}
				}
				if (playerToken2 && (game.players.filter(k => k === playerToken2).length <= 0))
					return `[${playerToken2}] not in game "${game.name}"`;

				if (typeof expectedStage !== 'undefined') {
					const count = game.players.filter(k => players[k].reinforcement > 0).length;
					switch (expectedStage.stage) {
						case GameStage.GameOpened: // round: -1
							switch (expectedStage.expected) {
								case Expected.Before:
									return 'Invalid expected game stage "Before game opened"';
								case Expected.OnOrBefore:
									if (game.round > -1) return `Game "${game.name}" already started`;
									break;
								case Expected.OnOrAfter: // "On or after game opened" always true
									break;
								case Expected.After:
									if (game.round <= -1) return `Game "${game.name}" not yet started`;
									break;
							}
							break;
						case GameStage.GameStarted: // round: 0
							switch (expectedStage.expected) {
								case Expected.Before:
									if (game.round >= 0) return `Game "${game.name}" already started`;
									break;
								case Expected.OnOrBefore:
									if (game.round > 0) return `Game "${game.name}" already in progress`;
									break;
								case Expected.OnOrAfter:
									if (game.round < 0) return `Game "${game.name}" not yet started`;
									break;
								case Expected.After:
									if (game.round <= 0) return `Game "${game.name}" not yet ready`;
									break;
							}
							break;
						case GameStage.GameInProgress:
							switch (expectedStage.expected) {
								case Expected.Before:
									if (game.round >= 1) return `Game "${game.name}" already in progress`;
									break;
								case Expected.OnOrBefore:
									return 'Invalid expected game stage "On or before game in progress"';
								case Expected.OnOrAfter:
									if (game.round <= 0) return `Game "${game.name}" not yet ready`;
									break;
								case Expected.After:
									return 'Invalid expected game stage "After game in progress"';
							}
							break;
					}
				}
			}
		};
	};
};

export const validateNumOfPlayers = (players: Record<string, Player>, game: Game, option: {checkLack?: boolean, checkFull?: boolean}) => {
	const playerCnt = game.players.filter(p => players[p].status !== Status.Defeated).length;
	if ((playerCnt < rules.MinPlayerPerGame) && option.checkLack) {
		return `Not enough players in the game "${game.name}" yet`;
	} else if ((playerCnt >= rules.MaxPlayerPerGame) && option.checkFull) {
		return `Game "${game.name}" already full`;
	} else {
		return undefined;
	}
};
