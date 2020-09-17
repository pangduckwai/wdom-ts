import { Game, Player } from '../queries';
import { Card, _shuffle, Territories, WildCards, Territory } from '.';

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

export const getValidator = (
  map: Record<Territories, Territory>,
	deck: Record<Territories | WildCards, Card>,
) => {
  return (
    players: Record<string, Player>,
    games: Record<string, Game>,
  ) => {
    return ({
      playerToken, playerToken2, hostToken, gameToken, territory, territory2, cards, expectedStage
    }: {
      playerToken?: string;
      playerToken2?: string;
      hostToken?: string;
      gameToken?: string;
      territory?: string;
      territory2?: string;
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
      if (cards) {
        for (const card of cards) {
          if (!deck[card as Territories | WildCards]) return `Invalid card "${card}"`;
        }
      }

      if (gameToken) {
        const game = games[gameToken];
        const player = playerToken ? players[playerToken] : null;

        if (!game) return `Game "${gameToken}" not found`;

        if ((hostToken) && (game.host !== hostToken))
          return `Player "${players[hostToken].name}" is not the host of game "${game.name}"`;

        if (player) {
          if (game.round >= 0) {
            // Players already join games
            if (game.players.filter(k => k === playerToken).length <= 0)
              return `Player "${player.name}" not found in game "${game.name}"`;
            if (!player.joined || (player.joined !== gameToken))
              return `Player "${player.name}" not in game "${game.name}"`;
            if (game.players[game.turns] !== playerToken)
              return `It is not the turn of player "${player.name}"`;
          }
        }
        if (playerToken2 && (game.players.filter(k => k === playerToken2).length <= 0))
          return `Player "${playerToken2}" not in game "${game.name}"`;

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
