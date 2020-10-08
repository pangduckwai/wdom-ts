import { buildFederatedSchema } from '@apollo/federation';
import gql from 'graphql-tag';
import { QueryContext } from '.';

export const typeDefs = gql`
type Query {
	me: Self
	myGame: Game
}

type Self @key(fields: "token") {
	token: String!
	name: String!
	status: Int!
	reinforcement: Int!
	selected: String
	joined: String
	cards: [String]!
	holdings: [Territory]!
	sessionid: String
}

type Others @key(fields: "token") {
	token: String!
	name: String!
	status: Int!
	selected: String
	joined: String
	holdings: [Territory]!
}

type Game @key(fields: "token") {
	token: String!
	name: String!
	status: Int!
	round: Int!
	turns: Int!
	players: [Others]!
	lastBattleR: [Int]
	lastBattleW: [Int]
}

type Territory {
	name: String!
	troop: Int!
}`;

export const resolvers = {
	Query: {
		me: async (_: any, __: any, { snapshot, sessionId }: QueryContext): Promise<{
			token: string;
			name: string;
			status: number;
			reinforcement: number;
			selected?: string;
			joined?: string;
			cards: string[];
			holdings: {
				name: string;
				troop: number;
			}[];
			sessionid?: string;
		} | undefined> => {
			if (sessionId) {
				const { logins, players, games } = await snapshot.read();
				if (logins[sessionId] && players[logins[sessionId]]) {
					const { wonBattle, joined, cards, holdings, ...player } = players[logins[sessionId]];
					return {
						...player,
						joined,
						cards: Object.keys(cards),
						holdings: (joined) ? holdings.map(t => {
							const { continent, connected, ...rest } = games[joined].map[t];
							return rest;
						}) : []
					};
				}
			}
		},
		myGame: async (_: any, __: any, { snapshot, sessionId }: QueryContext): Promise<any> => {
			if (sessionId) {
				const { logins, players, games } = await snapshot.read();
				if (logins[sessionId] && players[logins[sessionId]]) {
					const { joined } = players[logins[sessionId]];
					if (joined && games[joined]) {
						const { host, ruleType, redeemed, cards, world, map, players, lastBattle, ...game } = games[joined];
						return {
							...game,
							
						};
					}
				}
			}
		},
	}
};

export const schema = buildFederatedSchema([{ typeDefs, resolvers }]);
