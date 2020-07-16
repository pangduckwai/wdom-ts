import { ApolloError } from 'apollo-server-errors';
import gql from 'graphql-tag';
import { Commit, CommitStore, CommandContext, Commands } from '.';

export const typeDefs = gql`
type Query {
	getCommitById(id: string): Commit
	getCommits(fromTime: String, toTime: String): [Commit]!
}

type Mutation {
	registerPlayer(playerName: string): Response!
	leaveGameRoom(playerToken: string): Response!
	openGame(playerToken: string, gameName: string): Response!
	closeGame(playerToken: string): Response!
	joinGame(playerToken: string, gameToken: string): Response!
	quitGame(playerToken: string): Response!
	startGame(playerToken: string): Response!
	assignTerritory(playerToken: string, gameToken: string, territoryName: string): Response!
	selectTerritory(playerToken: string, gameToken: string, territoryName: string): Response!
	attackTerritory(
		playerToken: string
		gameToken: string
		fromTerritory: string
		toTerritory: string
		attackerLoss: number
		defenderLoss: number
	): Response!
	conquerTerritory(
		fromPlayer: string
		toPlayer: string
		gameToken: string
		fromTerritory: string
		toTerritory: string
	): Response!
	fortify(
		playerToken: string
		gameToken: string
		fromTerritory: string
		toTerritory: string
		amount: number
	): Response!
	defeatPlayer(fromPlayer: string, toPlayer: string, gameToken: string): Response!
	placeTroop(playerToken: string, gameToken: string, territoryName: string): Response!
	addTroop(playerToken: string, gameToken: string, territoryName: string): Response!
	nextPlayer(fromPlayer: string, toPlayer: string, gameToken: string): Response!
	finishSetup(playerToken: string, gameToken: string): Response!
	endTurn(playerToken: string, gameToken: string): Response!
	returnCard(playerToken: string, gameToken: string, cardName: string): Response!
	redeemCards(playerToken: string, gameToken: string, cardNames: [string]!): Response!
	winGame(playerToken: string, gameToken: string): Response!
}

type Event {
	type: string
}

type Commit {
	id: string
	version: number
	events: [Event]!
	timestamp: String
}

type Error {
	message: string
}

union Response = Commit | Error
`;

export const resolvers = {
	Query: {
		getCommitById: async (
			_: any, { id }: { id: string }, { client, channel }: CommandContext
		): Promise<Commit | ApolloError> =>
			CommitStore.get(client, channel, { id })
				.then(result => (result.length > 0) ? result[0] : new ApolloError('Invalid result from CommitStore.get()'))
				.catch(error => new ApolloError(error)),
		getCommits: async (
			_: any, { fromTime, toTime }: { fromTime?: string, toTime?: string}, { client, channel }: CommandContext
		): Promise<Commit[] | ApolloError> => {
			const args: { fromTime?: number, toTime?: number } = {};
			if (fromTime) args.fromTime = parseInt(fromTime, 10);
			if (toTime) args.toTime = parseInt(toTime, 10);
			return CommitStore.get(client, channel, args)
				.then(result => result)
				.catch(error => new ApolloError(error));
		},
	},
	Mutation: {
		registerPlayer: async (_: any, { playerName }: { playerName: string }, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.RegisterPlayer({ playerName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		leaveGameRoom: async (_: any, { playerToken }: { playerToken: string }, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.PlayerLeave({ playerToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		openGame: async (
			_: any, { playerToken, gameName }: { playerToken: string, gameName: string }, { client, channel }: CommandContext
		): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.OpenGame({ playerToken, gameName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		closeGame: async (_: any,{ playerToken }: { playerToken: string }, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.CloseGame({ playerToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		joinGame: async (
			_: any, { playerToken, gameToken }: { playerToken: string, gameToken: string }, { client, channel }: CommandContext
		): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.JoinGame({ playerToken, gameToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		quitGame: async (_: any,{ playerToken }: { playerToken: string }, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.QuitGame({ playerToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		startGame: async (_: any,{ playerToken }: { playerToken: string }, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.StartGame({ playerToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		assignTerritory: async (_: any, { playerToken, gameToken, territoryName }: {
			playerToken: string, gameToken: string, territoryName: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.AssignTerritory({ playerToken, gameToken, territoryName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		selectTerritory: async (_: any, { playerToken, gameToken, territoryName }: {
			playerToken: string, gameToken: string, territoryName: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.SelectTerritory({ playerToken, gameToken, territoryName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		attackTerritory: async (_: any, { playerToken, gameToken, fromTerritory, toTerritory, attackerLoss, defenderLoss }: {
			playerToken: string, gameToken: string, fromTerritory: string, toTerritory: string, attackerLoss: number, defenderLoss: number
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.AttackTerritory({
					playerToken, gameToken, fromTerritory, toTerritory, attackerLoss, defenderLoss
			})).then(result => result)
				.catch(error => new ApolloError(error)),
		conquerTerritory: async (_: any, { fromPlayer, toPlayer, gameToken, fromTerritory, toTerritory }: { 
			fromPlayer: string, toPlayer: string, gameToken: string, fromTerritory: string, toTerritory: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.ConquerTerritory({ fromPlayer, toPlayer, gameToken, fromTerritory, toTerritory }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		fortify: async (_: any, { playerToken, gameToken, fromTerritory, toTerritory, amount }: { 
			playerToken: string, gameToken: string, fromTerritory: string, toTerritory: string, amount: number
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.Fortify({ playerToken, gameToken, fromTerritory, toTerritory, amount }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		defeatPlayer: async (_: any, { fromPlayer, toPlayer, gameToken }: {
			fromPlayer: string, toPlayer: string, gameToken: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.DefeatPlayer({ fromPlayer, toPlayer, gameToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		placeTroop: async (_: any, { playerToken, gameToken, territoryName }: {
			playerToken: string, gameToken: string, territoryName: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.PlaceTroop({ playerToken, gameToken, territoryName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		addTroop: async (_: any, { playerToken, gameToken, territoryName }: {
			playerToken: string, gameToken: string, territoryName: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.AddTroop({ playerToken, gameToken, territoryName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		nextPlayer: async (_: any, { fromPlayer, toPlayer, gameToken }: {
			fromPlayer: string, toPlayer: string, gameToken: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.NextPlayer({ fromPlayer, toPlayer, gameToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		finishSetup: async (
			_: any, { playerToken, gameToken }: { playerToken: string, gameToken: string }, { client, channel }: CommandContext
		): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.FinishSetup({ playerToken, gameToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		endTurn: async (
			_: any, { playerToken, gameToken }: { playerToken: string, gameToken: string }, { client, channel }: CommandContext
		): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.EndTurn({ playerToken, gameToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		returnCard: async (_: any, { playerToken, gameToken, cardName }: {
			playerToken: string, gameToken: string, cardName: string
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.ReturnCard({ playerToken, gameToken, cardName }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		redeemCards: async (_: any, { playerToken, gameToken, cardNames }: {
			playerToken: string, gameToken: string, cardNames: string[]
		}, { client, channel }: CommandContext): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.RedeemCards({ playerToken, gameToken, cardNames }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
		winGame: async (
			_: any, { playerToken, gameToken }: { playerToken: string, gameToken: string }, { client, channel }: CommandContext
		): Promise<Commit | Error> =>
			CommitStore.put(client, channel, Commands.WinGame({ playerToken, gameToken }))
				.then(result => result)
				.catch(error => new ApolloError(error)),
	},
};
