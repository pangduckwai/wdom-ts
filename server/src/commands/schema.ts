import { buildFederatedSchema } from '@apollo/federation';
import { ApolloError } from 'apollo-server-errors';
import gql from 'graphql-tag';
import { RuleTypes } from '../rules';
import { Commit, CommandContext } from '.';
import { Status } from '..';

export const typeDefs = gql`
type Query {
	getCommitById(id: String!): Commit
	getCommits(fromTime: String, toTime: String): [Commit]!
}

type Mutation {
	registerPlayer(playerName: String!): Response!
	leaveGameRoom: Response!
	openGame(gameName: String!, ruleType: String!): Response!
	closeGame: Response!
	joinGame(gameToken: String!): Response!
	quitGame: Response!
	startGame: Response!
	makeMove(
		territoryName: String!
		flag: Int!
	): Response!
	endTurn: Response!
	fortify(
		territoryName: String!
		amount: Int!
	): Response!
	redeemCards(cardNames: [String!]!): Response!
}

type Event {
	type: String!
}

type Commit {
	id: String!
	version: Int!
	session: String!
	events: [Event]!
	timestamp: String
}

type Error {
	message: String!
}

union Response = Commit | Error
`;

export const resolvers = {
	Response: {
		__resolveType: (obj: any) => (obj.id) ? 'Commit' : (obj.message) ? 'Error' : {}
	},
	Query: {
		getCommitById: async (_: any, { id }: any, { commitStore }: CommandContext): Promise<Commit | ApolloError> =>
			commitStore.get({ id })
				.then(result => (result.length > 0) ? result[0] : new ApolloError('Invalid result from CommitStore.get()'))
				.catch(error => new ApolloError(error)),
		getCommits: async (
			_: any, { fromTime, toTime }: any, { commitStore }: CommandContext
		): Promise<Commit[] | ApolloError> => {
			const args = {
        from: fromTime ? fromTime as string : undefined,
        to: toTime ? toTime as string : undefined
      };
			return commitStore.get(args)
				.then(result => result)
				.catch(error => new ApolloError(error));
		},
	},
	Mutation: {
    registerPlayer: async (_: any, { playerName }: any, { commands }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				return commands.RegisterPlayer({ playerName })
			} catch (error) {
				return new ApolloError(error);
			}
		},
		leaveGameRoom: async (_: any, __: any, { snapshot, commands, sessionId }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				const { playerToken } = await snapshot.auth(sessionId);
				return commands.PlayerLeave({ playerToken });
			} catch (error) {
				return new ApolloError(error);
			}
		},
		openGame: async (
			_: any, { gameName, ruleType }: any, { snapshot, commands, sessionId }: CommandContext
		): Promise<Commit | ApolloError> => {
			try {
				const { playerToken } = await snapshot.auth(sessionId);
				return commands.OpenGame({
					playerToken,
					gameName,
					ruleType: ruleType as RuleTypes
				});
			} catch (error) {
				return new ApolloError(error);
			}
		},
		closeGame: async (_: any, __: any, { snapshot, commands, sessionId }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				const { playerToken } = await snapshot.auth(sessionId);
				return commands.CloseGame({ playerToken });
			} catch (error) {
				return new ApolloError(error);
			}
		},
		joinGame: async (_: any, { gameToken }: any, { snapshot, commands, sessionId }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				const { playerToken } = await snapshot.auth(sessionId);
				return commands.JoinGame({ playerToken, gameToken });
			} catch (error) {
				return new ApolloError(error);
			}
		},
		quitGame: async (_: any, __: any, { snapshot, commands, sessionId }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				const { playerToken } = await snapshot.auth(sessionId);
				return commands.QuitGame({ playerToken });
			} catch (error) {
				return new ApolloError(error);
			}
		},
		startGame: async (_: any, __: any, { snapshot, commands, sessionId }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				const { playerToken, players } = await snapshot.auth(sessionId);
				const gameToken = players[playerToken].joined;
				if (gameToken)
					return commands.StartGame({ playerToken, gameToken });
				else
					return new ApolloError('Player not in any game yet');
			} catch (error) {
				return new ApolloError(error);
			}
		},
		makeMove: async (
			_: any, { territoryName, flag }: any, { snapshot, commands, sessionId }: CommandContext
		): Promise<Commit | ApolloError> => {
			try {
				const { playerToken, players } = await snapshot.auth(sessionId);
				const gameToken = players[playerToken].joined;
				if (gameToken)
					return commands.MakeMove({ playerToken, gameToken, territoryName, flag });
				else
					return new ApolloError('Player not in any game yet');
			} catch (error) {
				return new ApolloError(error);
			}
		},
		endTurn: async (_: any, __: any, { snapshot, commands, sessionId }: CommandContext): Promise<Commit | ApolloError> => {
			try {
				const { playerToken, players } = await snapshot.auth(sessionId);
				const gameToken = players[playerToken].joined;
				if (gameToken)
					return commands.EndTurn({ playerToken, gameToken });
				else
					return new ApolloError('Player not in any game yet');
			} catch (error) {
				return new ApolloError(error);
			}
		},
		fortify: async (
			_: any, { territoryName, amount }: any, { snapshot, commands, sessionId }: CommandContext
		): Promise<Commit | Error> =>{
			try {
				const { playerToken, players } = await snapshot.auth(sessionId);
				const gameToken = players[playerToken].joined;
				if (gameToken)
					return commands.FortifyPosition({ playerToken, gameToken, territoryName, amount });
				else
					return new ApolloError('Player not in any game yet');
			} catch (error) {
				return new ApolloError(error);
			}
		},
		redeemCards: async (
			_: any, { cardNames }: any, { snapshot, commands, sessionId }: CommandContext
		): Promise<Commit | Error> =>{
			try {
				const { playerToken, players } = await snapshot.auth(sessionId);
				const gameToken = players[playerToken].joined;
				if (gameToken)
					return commands.RedeemCards({ playerToken, gameToken, cardNames });
				else
					return new ApolloError('Player not in any game yet');
			} catch (error) {
				return new ApolloError(error);
			}
		},
	},
};

export const schema = buildFederatedSchema([{ typeDefs, resolvers }]);