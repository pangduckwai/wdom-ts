import { Card, Continent, Continents, Territories } from '..';

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
				return 29; // real 35;
			case 4:
				return 24; // real 30;
			case 5:
				return 19; // real 25;
			case 6:
				return 14; // real 20;
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
				return 15;
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
		let red = [5,5,5];
		if (attacker === 1)
			red = [5];
		else if (attacker === 2)
			red = [5,5];

		let white = [5,4];
		if (defender === 1)
			white = [4];
		else if (attacker === 5)
			white = [4,4];
		else if ((attacker - defender) >= 5)
			white = [4,4];

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
