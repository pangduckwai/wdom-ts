import { Cards, Territories, WildCards } from '.';

export interface Card {
	name: Territories | WildCards;
	type: Cards;
}

// TODO: shuffleCards ???

export const buildDeck = (): Record<Territories | WildCards, Card> => {
	return {
		[WildCards.One]: {
			name: WildCards.One, type: Cards.Wildcard
		},
		[WildCards.Two]: {
			name: WildCards.Two, type: Cards.Wildcard
		},
		[Territories.Congo]: {
			name: Territories.Congo, type: Cards.Artillery
		},
		[Territories.EastAfrica]: {
			name: Territories.EastAfrica, type: Cards.Infantry
		},
		[Territories.Egypt]: {
			name: Territories.Egypt, type: Cards.Cavalry
		},
		[Territories.Madagascar]: {
			name: Territories.Madagascar, type: Cards.Cavalry
		},
		[Territories.NorthAfrica]: {
			name: Territories.NorthAfrica, type: Cards.Infantry
		},
		[Territories.SouthAfrica]: {
			name: Territories.SouthAfrica, type: Cards.Artillery
		},
		[Territories.Afghanistan]: {
			name: Territories.Afghanistan, type: Cards.Infantry
		},
		[Territories.China]: {
			name: Territories.China, type: Cards.Artillery
		},
		[Territories.India]: {
			name: Territories.India, type: Cards.Cavalry
		},
		[Territories.Irkutsk]: {
			name: Territories.Irkutsk, type: Cards.Artillery
		},
		[Territories.Japan]: {
			name: Territories.Japan, type: Cards.Cavalry
		},
		[Territories.Kamchatka]: {
			name: Territories.Kamchatka, type: Cards.Artillery
		},
		[Territories.Manchuria]: {
			name: Territories.Manchuria, type: Cards.Cavalry
		},
		[Territories.MiddleEast]: {
			name: Territories.MiddleEast, type: Cards.Artillery
		},
		[Territories.Siam]: {
			name: Territories.Siam, type: Cards.Cavalry
		},
		[Territories.Siberia]: {
			name: Territories.Siberia, type: Cards.Infantry
		},
		[Territories.Ural]: {
			name: Territories.Ural, type: Cards.Infantry
		},
		[Territories.Yakutsk]: {
			name: Territories.Yakutsk, type: Cards.Artillery
		},
		[Territories.EasternAustralia]: {
			name: Territories.EasternAustralia, type: Cards.Cavalry
		},
		[Territories.Indonesia]: {
			name: Territories.Indonesia, type: Cards.Infantry
		},
		[Territories.NewGuinea]: {
			name: Territories.NewGuinea, type: Cards.Cavalry
		},
		[Territories.WesternAustralia]: {
			name: Territories.WesternAustralia, type: Cards.Artillery
		},
		[Territories.GreatBritain]: {
			name: Territories.GreatBritain, type: Cards.Infantry
		},
		[Territories.Iceland]: {
			name: Territories.Iceland, type: Cards.Cavalry
		},
		[Territories.NorthernEurope]: {
			name: Territories.NorthernEurope, type: Cards.Cavalry
		},
		[Territories.Scandinavia]: {
			name: Territories.Scandinavia, type: Cards.Infantry
		},
		[Territories.SouthernEurope]: {
			name: Territories.SouthernEurope, type: Cards.Infantry
		},
		[Territories.Ukraine]: {
			name: Territories.Ukraine, type: Cards.Infantry
		},
		[Territories.WesternEurope]: {
			name: Territories.WesternEurope, type: Cards.Infantry
		},
		[Territories.Alaska]: {
			name: Territories.Alaska, type: Cards.Artillery
		},
		[Territories.Alberta]: {
			name: Territories.Alberta, type: Cards.Artillery
		},
		[Territories.EasternUnitedStates]: {
			name: Territories.EasternUnitedStates, type: Cards.Artillery
		},
		[Territories.Greenland]: {
			name: Territories.Greenland, type: Cards.Cavalry
		},
		[Territories.Mexico]: {
			name: Territories.Mexico, type: Cards.Infantry
		},
		[Territories.NorthwestTerritory]: {
			name: Territories.NorthwestTerritory, type: Cards.Cavalry
		},
		[Territories.Ontario]: {
			name: Territories.Ontario, type: Cards.Artillery
		},
		[Territories.Quebec]: {
			name: Territories.Quebec, type: Cards.Artillery
		},
		[Territories.WesternUnitedStates]: {
			name: Territories.WesternUnitedStates, type: Cards.Artillery
		},
		[Territories.Argentina]: {
			name: Territories.Argentina, type: Cards.Infantry
		},
		[Territories.Brazil]: {
			name: Territories.Brazil, type: Cards.Infantry
		},
		[Territories.Peru]: {
			name: Territories.Peru, type: Cards.Cavalry
		},
		[Territories.Venezuela]: {
			name: Territories.Venezuela, type: Cards.Cavalry
		}
	};
};