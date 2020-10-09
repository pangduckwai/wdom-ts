import { buildFederatedSchema } from '@apollo/federation';
import { ApolloError } from 'apollo-server-errors';
import gql from 'graphql-tag';
import { Status } from '..';
import { Message, QueryContext } from '.';

export const typeDefs = gql`
type Query {
	me: Self
	myGame: Game
	messages(commitId: String!): [Message]
}

type Self @key(fields: "token") {
	token: String!
	name: String!
	status: String!
	reinforcement: Int!
	selected: String
	joined: String
	cards: [String]!
	holdings: [Territory]!
}

type Others @key(fields: "token") {
	token: String!
	name: String!
	status: String!
	selected: String
	joined: String
	holdings: [Territory]!
}

type Game @key(fields: "token") {
	token: String!
	name: String!
	status: String!
	round: Int!
	turns: Int!
	players: [Others]!
	lastBattleR: [Int]
	lastBattleW: [Int]
}

type Territory {
	name: String!
	troop: Int!
}

type Message {
	commitId: String!
	type: Int!
	eventName: String!
	message: String!
	timestamp: String
}`;

export const resolvers = {
	Query: {
		me: async (_: any, __: any, { snapshot, sessionId }: QueryContext): Promise<{
			token: string;
			name: string;
			status: Status;
			reinforcement: number;
			selected?: string;
			joined?: string;
			cards: string[];
			holdings: {
				name: string;
				troop: number;
			}[];
			sessionid?: string;
		} | ApolloError> => {
			if (!sessionId) return new ApolloError('Please register as a player to proceed');
			try {
				const { playerToken, players, games } = await snapshot.auth(sessionId);
				const { wonBattle, joined, cards, holdings, ...player } = players[playerToken];
				return {
					...player,
					joined,
					cards: Object.keys(cards),
					holdings: (joined) ? holdings.map(t => {
						const { continent, connected, ...rest } = games[joined].map[t];
						return rest;
					}) : []
				};
			} catch (error) {
				return new ApolloError(error);
			}
		},
		myGame: async (_: any, __: any, { snapshot, sessionId }: QueryContext): Promise<{
			token: string;
			name: string;
			status: Status;
			round: number;
			turns: number;
			players: {
				token: string;
				name: string;
				status: Status;
				selected?: string;
				joined?: string;
				holdings: {
					name: string;
					troop: number;
				}[]
			}[],
			lastBattleR?: number[];
			lastBattleW?: number[];
		} | ApolloError> => {
			const { playerToken, players, games } = await snapshot.auth(sessionId);
			const { joined } = players[playerToken];
			if (!joined || !games[joined]) return new ApolloError('Please open/join a game to proceed');
			const { host, ruleType, redeemed, cards, world, map, players: tokens, lastBattle, ...game } = games[joined];
			return {
				...game,
				players: tokens.map(p => ({
					token: p,
					name: players[p].name,
					status: players[p].status,
					selected: players[p].selected,
					joined: players[p].joined,
					holdings: players[p].holdings.map(t => ({
						name: map[t].name, troop: map[t].troop
					}))
				})),
				lastBattleR: lastBattle?.redDice,
				lastBattleW: lastBattle?.whiteDice
			};
		},
		messages: async (_: any, { commitId }: any, { snapshot, messages, sessionId }: QueryContext): Promise<Message[] | ApolloError> => {
			if (!commitId) return new ApolloError('Invalid parameter specified');
			await snapshot.auth(sessionId);
			// const { joined } = players[playerToken];
			// if (!joined || !games[joined]) return new ApolloError('Please open/join a game to proceed');
			return messages(commitId);
		}
	}
};

export const schema = buildFederatedSchema([{ typeDefs, resolvers }]);
