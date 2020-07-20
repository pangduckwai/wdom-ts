
export const REGISTER_PLAYER = `
mutation RegisterPlayer($playerName: String!) {
	registerPlayer(playerName: $playerName) {
		... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
	}
}`;

export const PLAYER_LEAVE = `
mutation LeaveGameRoom($playerToken: String!) {
	leaveGameRoom(playerToken: $playerToken) {
		... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
	}
}`;

export const OPEN_GAME = `
mutation OpenGame($playerToken: String!, $gameName: String!) {
  openGame(playerToken: $playerToken, gameName: $gameName) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

export const JOIN_GAME = `
mutation JoinGame($playerToken: String!, $gameToken: String!) {
  joinGame(playerToken: $playerToken, gameToken: $gameToken) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

export const CLOSE_GAME = `
mutation CloseGame($playerToken: String!, $gameToken: String!) {
  closeGame(playerToken: $playerToken, gameToken: $gameToken) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

export const QUIT_GAME = `
mutation QuitGame($playerToken: String!, $gameToken: String!) {
  quitGame(playerToken: $playerToken, gameToken: $gameToken) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

export const START_GAME = `
mutation StartGame($playerToken: String!, $gameToken: String!) {
  startGame(playerToken: $playerToken, gameToken: $gameToken) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;

export const ASSIGN_TERRITORY = `
mutation AssignTerritory($playerToken: String!, $gameToken: String!, $territoryName: String!) {
  assignTerritory(playerToken: $playerToken, gameToken: $gameToken, territoryName: $territoryName) {
    ... on Commit {
			id
			version
			timestamp
		}
		... on Error {
			message
		}
  }
}`;