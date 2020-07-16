import { Continents, Territories} from '.';

export interface Territory {
	name: Territories;
	continent: Continents;
	connected: Set<Territories>;
}

export interface Continent {
	name: Continents;
	reinforcement: number;
	territories: Set<Territories>;
}

export const buildMap = (): Record<Territories, Territory> => {
	return { // TODO what about the 2 wild cards
		[Territories.Congo]: {
			name: Territories.Congo, continent: Continents.Africa, connected: new Set([Territories.EastAfrica, Territories.NorthAfrica, Territories.SouthAfrica])
		},
		[Territories.EastAfrica]: {
			name: Territories.EastAfrica, continent: Continents.Africa, connected: new Set([Territories.Congo, Territories.Egypt, Territories.Madagascar, Territories.NorthAfrica, Territories.SouthAfrica, Territories.MiddleEast])
		},
		[Territories.Egypt]: {
			name: Territories.Egypt, continent: Continents.Africa, connected: new Set([Territories.EastAfrica, Territories.NorthAfrica, Territories.MiddleEast, Territories.SouthernEurope])
		},
		[Territories.Madagascar]: {
			name: Territories.Madagascar, continent: Continents.Africa, connected: new Set([Territories.EastAfrica, Territories.SouthAfrica])
		},
		[Territories.NorthAfrica]: {
			name: Territories.NorthAfrica, continent: Continents.Africa, connected: new Set([Territories.Congo, Territories.Egypt, Territories.EastAfrica, Territories.SouthernEurope, Territories.WesternEurope, Territories.Brazil])
		},
		[Territories.SouthAfrica]: {
			name: Territories.SouthAfrica, continent: Continents.Africa, connected: new Set([Territories.Congo, Territories.EastAfrica, Territories.Madagascar])
		},
		[Territories.Afghanistan]: {
			name: Territories.Afghanistan, continent: Continents.Asia, connected: new Set([Territories.China, Territories.India, Territories.MiddleEast, Territories.Ural, Territories.Ukraine])
		},
		[Territories.China]: {
			name: Territories.China, continent: Continents.Asia, connected: new Set([Territories.Afghanistan, Territories.India, Territories.Manchuria, Territories.Siam, Territories.Siberia, Territories.Ural])
		},
		[Territories.India]: {
			name: Territories.India, continent: Continents.Asia, connected: new Set([Territories.Afghanistan, Territories.China, Territories.MiddleEast, Territories.Siam])
		},
		[Territories.Irkutsk]: {
			name: Territories.Irkutsk, continent: Continents.Asia, connected: new Set([Territories.Kamchatka, Territories.Manchuria, Territories.Siberia, Territories.Yakutsk])
		},
		[Territories.Japan]: {
			name: Territories.Japan, continent: Continents.Asia, connected: new Set([Territories.Kamchatka, Territories.Manchuria])
		},
		[Territories.Kamchatka]: {
			name: Territories.Kamchatka, continent: Continents.Asia, connected: new Set([Territories.Irkutsk, Territories.Japan, Territories.Manchuria, Territories.Yakutsk, Territories.Alaska])
		},
		[Territories.Manchuria]: {
			name: Territories.Manchuria, continent: Continents.Asia, connected: new Set([Territories.China, Territories.Irkutsk, Territories.Japan, Territories.Kamchatka, Territories.Siberia])
		},
		[Territories.MiddleEast]: {
			name: Territories.MiddleEast, continent: Continents.Asia, connected: new Set([Territories.Afghanistan, Territories.India, Territories.Egypt, Territories.EastAfrica, Territories.SouthernEurope, Territories.Ukraine])
		},
		[Territories.Siam]: {
			name: Territories.Siam, continent: Continents.Asia, connected: new Set([Territories.China, Territories.India, Territories.Indonesia])
		},
		[Territories.Siberia]: {
			name: Territories.Siberia, continent: Continents.Asia, connected: new Set([Territories.China, Territories.Irkutsk, Territories.Manchuria, Territories.Ural, Territories.Yakutsk])
		},
		[Territories.Ural]: {
			name: Territories.Ural, continent: Continents.Asia, connected: new Set([Territories.Afghanistan, Territories.China, Territories.Siberia, Territories.Ukraine])
		},
		[Territories.Yakutsk]: {
			name: Territories.Yakutsk, continent: Continents.Asia, connected: new Set([Territories.Irkutsk, Territories.Kamchatka, Territories.Siberia])
		},
		[Territories.EasternAustralia]: {
			name: Territories.EasternAustralia, continent: Continents.Australia, connected: new Set([Territories.NewGuinea, Territories.WesternAustralia])
		},
		[Territories.Indonesia]: {
			name: Territories.Indonesia, continent: Continents.Australia, connected: new Set([Territories.NewGuinea, Territories.WesternAustralia, Territories.Siam])
		},
		[Territories.NewGuinea]: {
			name: Territories.NewGuinea, continent: Continents.Australia, connected: new Set([Territories.EasternAustralia, Territories.Indonesia, Territories.WesternAustralia])
		},
		[Territories.WesternAustralia]: {
			name: Territories.WesternAustralia, continent: Continents.Australia, connected: new Set([Territories.EasternAustralia, Territories.Indonesia, Territories.NewGuinea])
		},
		[Territories.GreatBritain]: {
			name: Territories.GreatBritain, continent: Continents.Europe, connected: new Set([Territories.Iceland, Territories.NorthernEurope, Territories.Scandinavia, Territories.WesternEurope])
		},
		[Territories.Iceland]: {
			name: Territories.Iceland, continent: Continents.Europe, connected: new Set([Territories.GreatBritain, Territories.Scandinavia, Territories.Greenland])
		},
		[Territories.NorthernEurope]: {
			name: Territories.NorthernEurope, continent: Continents.Europe, connected: new Set([Territories.GreatBritain, Territories.Scandinavia, Territories.SouthernEurope, Territories.Ukraine, Territories.WesternEurope])
		},
		[Territories.Scandinavia]: {
			name: Territories.Scandinavia, continent: Continents.Europe, connected: new Set([Territories.GreatBritain, Territories.Iceland, Territories.NorthernEurope, Territories.Ukraine])
		},
		[Territories.SouthernEurope]: {
			name: Territories.SouthernEurope, continent: Continents.Europe, connected: new Set([Territories.NorthernEurope, Territories.Ukraine, Territories.WesternEurope, Territories.Egypt, Territories.NorthAfrica, Territories.MiddleEast])
		},
		[Territories.Ukraine]: {
			name: Territories.Ukraine, continent: Continents.Europe, connected: new Set([Territories.NorthernEurope, Territories.Scandinavia, Territories.SouthernEurope, Territories.Afghanistan, Territories.MiddleEast, Territories.Ural])
		},
		[Territories.WesternEurope]: {
			name: Territories.WesternEurope, continent: Continents.Europe, connected: new Set([Territories.GreatBritain, Territories.NorthernEurope, Territories.SouthernEurope, Territories.NorthAfrica])
		},
		[Territories.Alaska]: {
			name: Territories.Alaska, continent: Continents.NorthAmerica, connected: new Set([Territories.Alberta, Territories.NorthwestTerritory, Territories.Kamchatka])
		},
		[Territories.Alberta]: {
			name: Territories.Alberta, continent: Continents.NorthAmerica, connected: new Set([Territories.Alaska, Territories.NorthwestTerritory, Territories.Ontario, Territories.WesternUnitedStates])
		},
		[Territories.EasternUnitedStates]: {
			name: Territories.EasternUnitedStates, continent: Continents.NorthAmerica, connected: new Set([Territories.Mexico, Territories.Ontario, Territories.Quebec, Territories.WesternUnitedStates])
		},
		[Territories.Greenland]: {
			name: Territories.Greenland, continent: Continents.NorthAmerica, connected: new Set([Territories.NorthwestTerritory, Territories.Ontario, Territories.Quebec, Territories.Iceland])
		},
		[Territories.Mexico]: {
			name: Territories.Mexico, continent: Continents.NorthAmerica, connected: new Set([Territories.EasternUnitedStates, Territories.WesternUnitedStates, Territories.Venezuela])
		},
		[Territories.NorthwestTerritory]: {
			name: Territories.NorthwestTerritory, continent: Continents.NorthAmerica, connected: new Set([Territories.Alaska, Territories.Alberta, Territories.Greenland, Territories.Ontario])
		},
		[Territories.Ontario]: {
			name: Territories.Ontario, continent: Continents.NorthAmerica, connected: new Set([Territories.Alberta, Territories.EasternUnitedStates, Territories.Greenland, Territories.NorthwestTerritory, Territories.Quebec, Territories.WesternUnitedStates])
		},
		[Territories.Quebec]: {
			name: Territories.Quebec, continent: Continents.NorthAmerica, connected: new Set([Territories.EasternUnitedStates, Territories.Greenland, Territories.Ontario])
		},
		[Territories.WesternUnitedStates]: {
			name: Territories.WesternUnitedStates, continent: Continents.NorthAmerica, connected: new Set([Territories.Alberta, Territories.EasternUnitedStates, Territories.Mexico, Territories.Ontario])
		},
		[Territories.Argentina]: {
			name: Territories.Argentina, continent: Continents.SouthAmerica, connected: new Set([Territories.Brazil, Territories.Peru])
		},
		[Territories.Brazil]: {
			name: Territories.Brazil, continent: Continents.SouthAmerica, connected: new Set([Territories.Argentina, Territories.Peru, Territories.Venezuela, Territories.NorthAfrica])
		},
		[Territories.Peru]: {
			name: Territories.Peru, continent: Continents.SouthAmerica, connected: new Set([Territories.Argentina, Territories.Brazil, Territories.Venezuela])
		},
		[Territories.Venezuela]: {
			name: Territories.Venezuela, continent: Continents.SouthAmerica, connected: new Set([Territories.Brazil, Territories.Peru, Territories.Mexico])
		}
	};
};

export const buildContinents = (): Record<Continents, Continent> => {
	return {
		[Continents.Africa]: {
			name: Continents.Africa,
			reinforcement: 3,
			territories: new Set([
				Territories.Congo, Territories.EastAfrica, Territories.Egypt, Territories.Madagascar, Territories.NorthAfrica, Territories.SouthAfrica
			])
		},
		[Continents.Asia]: {
			name: Continents.Asia,
			reinforcement: 7,
			territories: new Set([
				Territories.Afghanistan,
				Territories.China,
				Territories.India,
				Territories.Irkutsk,
				Territories.Japan,
				Territories.Kamchatka,
				Territories.Manchuria,
				Territories.MiddleEast,
				Territories.Siam,
				Territories.Siberia,
				Territories.Ural,
				Territories.Yakutsk
			])
		},
		[Continents.Australia]: {
			name: Continents.Australia,
			reinforcement: 2,
			territories: new Set([
				Territories.EasternAustralia, Territories.Indonesia, Territories.NewGuinea, Territories.WesternAustralia
			])
		},
		[Continents.Europe]: {
			name: Continents.Europe,
			reinforcement: 5,
			territories: new Set([
				Territories.GreatBritain,
				Territories.Iceland,
				Territories.NorthernEurope,
				Territories.Scandinavia,
				Territories.SouthernEurope,
				Territories.Ukraine,
				Territories.WesternEurope
			])
		},
		[Continents.NorthAmerica]: {
			name: Continents.NorthAmerica,
			reinforcement: 5,
			territories: new Set([
				Territories.Alaska,
				Territories.Alberta,
				Territories.EasternUnitedStates,
				Territories.Greenland,
				Territories.Mexico,
				Territories.NorthwestTerritory,
				Territories.Ontario,
				Territories.Quebec,
				Territories.WesternUnitedStates
			])
		},
		[Continents.SouthAmerica]: {
			name: Continents.SouthAmerica,
			reinforcement: 2,
			territories: new Set([
				Territories.Argentina, Territories.Brazil, Territories.Peru, Territories.Venezuela
			])
		},
	}
};
