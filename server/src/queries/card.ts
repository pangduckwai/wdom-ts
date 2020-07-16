import { CardTypes, Territories, WildCards } from '.';

export interface Card {
	name: Territories | WildCards;
	type: CardTypes;
}

export const shuffleDeck = (): Card[] => {
	const cards = Object.values(buildDeck());
	let size = cards.length;

	while (size > 0) {
		const idx = Math.floor(Math.random() * size);
		const temp = cards[-- size];
		cards[size] = cards[idx];
		cards[idx] = temp;
	}

	return cards;
};

export const buildDeck = (): Record<Territories | WildCards, Card> => {
	return {
		[WildCards.One]: {
			name: WildCards.One, type: CardTypes.Wildcard
		},
		[WildCards.Two]: {
			name: WildCards.Two, type: CardTypes.Wildcard
		},
		[Territories.Congo]: {
			name: Territories.Congo, type: CardTypes.Artillery
		},
		[Territories.EastAfrica]: {
			name: Territories.EastAfrica, type: CardTypes.Infantry
		},
		[Territories.Egypt]: {
			name: Territories.Egypt, type: CardTypes.Cavalry
		},
		[Territories.Madagascar]: {
			name: Territories.Madagascar, type: CardTypes.Cavalry
		},
		[Territories.NorthAfrica]: {
			name: Territories.NorthAfrica, type: CardTypes.Infantry
		},
		[Territories.SouthAfrica]: {
			name: Territories.SouthAfrica, type: CardTypes.Artillery
		},
		[Territories.Afghanistan]: {
			name: Territories.Afghanistan, type: CardTypes.Infantry
		},
		[Territories.China]: {
			name: Territories.China, type: CardTypes.Artillery
		},
		[Territories.India]: {
			name: Territories.India, type: CardTypes.Cavalry
		},
		[Territories.Irkutsk]: {
			name: Territories.Irkutsk, type: CardTypes.Artillery
		},
		[Territories.Japan]: {
			name: Territories.Japan, type: CardTypes.Cavalry
		},
		[Territories.Kamchatka]: {
			name: Territories.Kamchatka, type: CardTypes.Artillery
		},
		[Territories.Manchuria]: {
			name: Territories.Manchuria, type: CardTypes.Cavalry
		},
		[Territories.MiddleEast]: {
			name: Territories.MiddleEast, type: CardTypes.Artillery
		},
		[Territories.Siam]: {
			name: Territories.Siam, type: CardTypes.Cavalry
		},
		[Territories.Siberia]: {
			name: Territories.Siberia, type: CardTypes.Infantry
		},
		[Territories.Ural]: {
			name: Territories.Ural, type: CardTypes.Infantry
		},
		[Territories.Yakutsk]: {
			name: Territories.Yakutsk, type: CardTypes.Artillery
		},
		[Territories.EasternAustralia]: {
			name: Territories.EasternAustralia, type: CardTypes.Cavalry
		},
		[Territories.Indonesia]: {
			name: Territories.Indonesia, type: CardTypes.Infantry
		},
		[Territories.NewGuinea]: {
			name: Territories.NewGuinea, type: CardTypes.Cavalry
		},
		[Territories.WesternAustralia]: {
			name: Territories.WesternAustralia, type: CardTypes.Artillery
		},
		[Territories.GreatBritain]: {
			name: Territories.GreatBritain, type: CardTypes.Infantry
		},
		[Territories.Iceland]: {
			name: Territories.Iceland, type: CardTypes.Cavalry
		},
		[Territories.NorthernEurope]: {
			name: Territories.NorthernEurope, type: CardTypes.Cavalry
		},
		[Territories.Scandinavia]: {
			name: Territories.Scandinavia, type: CardTypes.Infantry
		},
		[Territories.SouthernEurope]: {
			name: Territories.SouthernEurope, type: CardTypes.Infantry
		},
		[Territories.Ukraine]: {
			name: Territories.Ukraine, type: CardTypes.Infantry
		},
		[Territories.WesternEurope]: {
			name: Territories.WesternEurope, type: CardTypes.Infantry
		},
		[Territories.Alaska]: {
			name: Territories.Alaska, type: CardTypes.Artillery
		},
		[Territories.Alberta]: {
			name: Territories.Alberta, type: CardTypes.Artillery
		},
		[Territories.EasternUnitedStates]: {
			name: Territories.EasternUnitedStates, type: CardTypes.Artillery
		},
		[Territories.Greenland]: {
			name: Territories.Greenland, type: CardTypes.Cavalry
		},
		[Territories.Mexico]: {
			name: Territories.Mexico, type: CardTypes.Infantry
		},
		[Territories.NorthwestTerritory]: {
			name: Territories.NorthwestTerritory, type: CardTypes.Cavalry
		},
		[Territories.Ontario]: {
			name: Territories.Ontario, type: CardTypes.Artillery
		},
		[Territories.Quebec]: {
			name: Territories.Quebec, type: CardTypes.Artillery
		},
		[Territories.WesternUnitedStates]: {
			name: Territories.WesternUnitedStates, type: CardTypes.Artillery
		},
		[Territories.Argentina]: {
			name: Territories.Argentina, type: CardTypes.Infantry
		},
		[Territories.Brazil]: {
			name: Territories.Brazil, type: CardTypes.Infantry
		},
		[Territories.Peru]: {
			name: Territories.Peru, type: CardTypes.Cavalry
		},
		[Territories.Venezuela]: {
			name: Territories.Venezuela, type: CardTypes.Cavalry
		}
	};
};