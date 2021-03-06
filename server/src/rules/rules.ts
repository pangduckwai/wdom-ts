import crypto from 'crypto';
import { Card, Continent, Continents, Territories } from '.';

const MAX = 16777216; // Which is 0xffffff -> 3 bytes

export const rules = {
	MinPlayerPerGame: 3,
	MaxPlayerPerGame: 6,
	MaxCardsPerPlayer: 5,
	chooseFirstPlayer: (players: number) => Math.floor(Math.random() * players) + 1,
	basicReinforcement: (holdings: Territories[]) => {
		const ret = Math.floor(holdings.length / 3);
		return (ret < 3) ? 3 : ret;
	},
	continentReinforcement: (continents: Record<Continents, Continent>, holdings: Territories[]) => {
		return Object.values(continents).reduce((total, continent) => {
			const owned = holdings.filter(territory => continent.territories.has(territory)).length;
			return total + ((owned === continent.territories.size) ? continent.reinforcement : 0);
		}, 0);
	},
	initialTroops: (players: number): number => {
		switch(players) {
			case 3:
				return 35;
			case 4:
				return 30;
			case 5:
				return 25;
			case 6:
				return 20;
			default:
				return -1;
		}
	},
	redeemReinforcement: (last: number) => {
		switch(last) {
			case 0:
				return 4;
			case 4:
				return 6;
			case 6:
				return 8;
			case 8:
				return 10;
			default:
				if (last >= 10) {
					if (last < 65) {
						return (5 * Math.floor(last/5)) + 5;
					} else {
						return 65;
					}
				}
				return -1;
		}
	},
	isRedeemable: (cards: Card[]) => {
		if (cards.length < 3) return false;
		let a = cards.filter(c => (c.type === 'Artillery') || (c.type === 'Wildcard'));
		let c = cards.filter(c => (c.type === 'Cavalry') || (c.type === 'Wildcard'));
		let i = cards.filter(c => (c.type === 'Infantry') || (c.type === 'Wildcard'));
		return ((a.length >= 3) || (c.length >= 3) || (i.length >= 3) || ((a.length >= 1) && (c.length >= 1) && (i.length >= 1)));
	},
	doBattle: (attacker: number, defender: number) => {
		let red: number[] = [], white: number[] = [];

		let roll = (start: number, end: number, troops: number, dices: number[]) => {
			let r;
			for (let i = start; i < Math.min(troops, end+start); i ++) {
				r = Math.floor(parseInt(crypto.randomBytes(3).toString('hex'), 16) * 6 / MAX) + 1;
				for (let j = 0; j < dices.length; j ++) {
					if (r > dices[j]) {
						dices.splice(j, 0, r);
						break;
					}
				}
				if (dices.length === (i-start)) dices.push(r);
			}
		};

		roll(1, 3, attacker, red);
		roll(0, 2, defender, white);

		let casualties = { attacker: 0, defender: 0, red, white };
		for (let k = 0; k < Math.min(red.length, white.length); k ++) {
			if (red[k] > white[k]) {
				casualties.defender ++; //Defender lose
			} else {
				casualties.attacker ++; //Attacker lose
			}
		}
		return casualties;
	}
};
