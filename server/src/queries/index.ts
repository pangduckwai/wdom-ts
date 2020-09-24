import { Game, isGame, isPlayer, Player } from '../rules';

export * from './messages';
export * from './reducer';
export * from './snapshot';
export * from './subscriptions';

export const getToken = (input?: Game | Player | string) => {
  if (isGame(input) || isPlayer(input))
    return input.token;
  else if (typeof input === 'string')
    return input;
  else if (typeof input === 'undefined')
    return undefined
  else
    throw Error('[getToken] Invalid input type');
};

export enum Status {
  Deleted, New, Ready, Invalid
};
