import { Card, Continent, Continents, Territory } from '.';

export * from './card';
export * from './territory';

export const rules = {
	MinPlayerPerGame: 3,
	MaxPlayerPerGame: 6,
	MaxCardsPerPlayer: 5,
	chooseFirstPlayer: (players: number) => Math.floor(Math.random() * players) + 1,
	basicReinforcement: (holdings: Territory[]) => {
		const ret = Math.floor(holdings.length / 3);
		return (ret < 3) ? 3 : ret;
	},
	continentReinforcement: (continents: Record<Continents, Continent>, holdings: Territory[]) => {
		return Object.values(continents).reduce((total, continent) => {
			const owned = holdings.filter(territory => territory.continent === continent.name).length;
			return total + ((owned === continent.territories.size) ? continent.reinforcement : 0);
		}, 0);
	},
	initialTroops: (players: number): number => {
		switch(players) {
			case 3:
				return 19;
			case 4:
				return 15;
			case 5:
				return 13;
			case 6:
				return 12;
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
		let a = cards.filter(c => (c.type === 1) || (c.type === 0));
		let c = cards.filter(c => (c.type === 2) || (c.type === 0));
		let i = cards.filter(c => (c.type === 3) || (c.type === 0));
		return ((a.length >= 3) || (c.length >= 3) || (i.length >= 3) || ((a.length >= 1) && (c.length >= 1) && (i.length >= 1)));
	},
	doBattle: (attacker: number, defender: number) => {
		let rdice: number[] = [], wdice: number[] = [];

		let roll = (start: number, end: number, troops: number, dices: number[]) => {
			let r;
			for (let i = start; i < Math.min(troops, end+start); i ++) {
				r = Math.floor(Math.random() * 6) + 1;
				for (let j = 0; j < dices.length; j ++) {
					if (r > dices[j]) {
						dices.splice(j, 0, r);
						break;
					}
				}
				if (dices.length === (i-start)) dices.push(r);
			}
		};

		roll(1, 3, attacker, rdice);
		roll(0, 2, defender, wdice);

		let casualties = { attacker: 0, defender: 0 };
		for (let k = 0; k < Math.min(rdice.length, wdice.length); k ++) {
			if (rdice[k] > wdice[k]) {
				casualties.defender ++; //Defender lose
			} else {
				casualties.attacker ++; //Attacker lose
			}
		}
		return casualties;
	}
};