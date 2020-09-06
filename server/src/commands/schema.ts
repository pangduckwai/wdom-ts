import { buildFederatedSchema } from '@apollo/federation';
import { ApolloError } from 'apollo-server-errors';
import gql from 'graphql-tag';
import { Commit, CommandContext, getCommands, getCommitStore } from '.';

export const typeDefs = gql`
type Query {
	getCommitById(id: String!): Commit
	getCommits(fromTime: String, toTime: String): [Commit]!
}

type Mutation {
	registerPlayer(playerName: String!): Response!
	leaveGameRoom(playerToken: String!): Response!
	openGame(playerToken: String!, gameName: String!): Response!
	closeGame(playerToken: String!): Response!
	joinGame(playerToken: String!, gameToken: String!): Response!
	quitGame(playerToken: String!): Response!
	startGame(playerToken: String!, gameToken: String!): Response!
	selectTerritory(playerToken: String!, gameToken: String!, territoryName: String!): Response!
	attackTerritory(
		playerToken: String!
		gameToken: String!
		fromTerritory: String!
		toTerritory: String!
		attackerLoss: Int!
		defenderLoss: Int!
	): Response!
	conquerTerritory(
		fromPlayer: String!
		toPlayer: String!
		gameToken: String!
		fromTerritory: String!
		toTerritory: String!
	): Response!
	fortify(
		playerToken: String!
		gameToken: String!
		fromTerritory: String!
		toTerritory: String!
		amount: Int!
	): Response!
	defeatPlayer(fromPlayer: String!, toPlayer: String!, gameToken: String!): Response!
	placeTroop(playerToken: String!, gameToken: String!, territoryName: String!, amount: Int): Response!
	nextPlayer(fromPlayer: String!, toPlayer: String!, gameToken: String!): Response!
	finishSetup(playerToken: String!, gameToken: String!): Response!
	endTurn(playerToken: String!, gameToken: String!): Response!
	redeemCards(playerToken: String!, gameToken: String!, cardNames: [String!]!): Response!
	winGame(playerToken: String!, gameToken: String!): Response!
}

type Event {
	type: String!
}

type Commit {
	id: String!
	version: Int!
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
		getCommitById: async (
			_: any, { id }: any, { client, channel }: CommandContext
    ): Promise<Commit | ApolloError> =>
      getCommitStore(channel, client).get({ id })
				.then(result => (result.length > 0) ? result[0] : new ApolloError('Invalid result from CommitStore.get()'))
				.catch(error => new ApolloError(error)),
		getCommits: async (
			_: any, { fromTime, toTime }: any, { client, channel }: CommandContext
		): Promise<Commit[] | ApolloError> => {
			const args = {
        from: fromTime ? fromTime as string : undefined,
        to: toTime ? toTime as string : undefined
      };
			return getCommitStore(channel, client).get(args)
				.then(result => result)
				.catch(error => new ApolloError(error));
		},
	},
	Mutation: {
    registerPlayer: async (_: any, { playerName }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
      getCommands(channel, client).RegisterPlayer({ playerName })
				.then(result => result)
				.catch(error => new ApolloError(error)),
		// leaveGameRoom: async (_: any, { playerToken }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.PlayerLeave({ playerToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// openGame: async (
		// 	_: any, { playerToken, gameName }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.OpenGame({ playerToken, gameName }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// closeGame: async (_: any,{ playerToken }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.CloseGame({ playerToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// joinGame: async (
		// 	_: any, { playerToken, gameToken }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.JoinGame({ playerToken, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// quitGame: async (_: any,{ playerToken }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.QuitGame({ playerToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// startGame: async (_: any,{ playerToken, gameToken }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.StartGame({ playerToken, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// selectTerritory: async (
		// 	_: any, { playerToken, gameToken, territoryName }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.SelectTerritory({ playerToken, gameToken, territoryName }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// attackTerritory: async (
		// 	_: any, { playerToken, gameToken, fromTerritory, toTerritory, attackerLoss, defenderLoss }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.AttackTerritory({
		// 			playerToken, gameToken, fromTerritory, toTerritory, attackerLoss, defenderLoss
		// 	})).then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// conquerTerritory: async (
		// 	_: any, { fromPlayer, toPlayer, gameToken, fromTerritory, toTerritory }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.ConquerTerritory({ fromPlayer, toPlayer, gameToken, fromTerritory, toTerritory }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// fortify: async (
		// 	_: any, { playerToken, gameToken, fromTerritory, toTerritory, amount }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.Fortify({ playerToken, gameToken, fromTerritory, toTerritory, amount }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// defeatPlayer: async (_: any, { fromPlayer, toPlayer, gameToken }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.DefeatPlayer({ fromPlayer, toPlayer, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// placeTroop: async (
		// 	_: any, { playerToken, gameToken, territoryName, amount }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.PlaceTroop({ playerToken, gameToken, territoryName, amount }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// nextPlayer: async (_: any, { fromPlayer, toPlayer, gameToken }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.NextPlayer({ fromPlayer, toPlayer, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// finishSetup: async (
		// 	_: any, { playerToken, gameToken }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.FinishSetup({ playerToken, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// endTurn: async (
		// 	_: any, { playerToken, gameToken }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.EndTurn({ playerToken, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// redeemCards: async (_: any, { playerToken, gameToken, cardNames }: any, { client, channel }: CommandContext): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.RedeemCards({ playerToken, gameToken, cardNames }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
		// winGame: async (
		// 	_: any, { playerToken, gameToken }: any, { client, channel }: CommandContext
		// ): Promise<Commit | Error> =>
		// 	CommitStore(client).put(channel, Commands.WinGame({ playerToken, gameToken }))
		// 		.then(result => result)
		// 		.catch(error => new ApolloError(error)),
	},
};

export const schema = buildFederatedSchema([{ typeDefs, resolvers }]);