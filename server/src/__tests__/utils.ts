export const SELECTS = [
['messages', 'Messages', `
query Messages($commitId: String!) {
  messages(commitId: $commitId) {
    commitId
    type
    eventName
    message
    timestamp
  }
}`]
];

export const UPDATES = [
['registerPlayer', 'RegisterPlayer', `
mutation RegisterPlayer($playerName: String!) {
	registerPlayer(playerName: $playerName) {
		... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
	}
}`],
['leaveGameRoom', 'LeaveGameRoom', `
mutation LeaveGameRoom {
	leaveGameRoom {
		... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
	}
}`],
['openGame', 'OpenGame', `
mutation OpenGame($gameName: String!, $ruleType: String!) {
  openGame(gameName: $gameName, ruleType: $ruleType) {
    ... on Commit {
			id
			version
      timestamp
      session
		}
		... on Error {
			message
		}
  }
}`],
];

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

/*
mutation {
  registerPlayer(playerName: "josh") {
    ... on Commit {
      id
      version
      session
      timestamp
      events {
        type
      }
    }
    ... on Error {
      message
    }
  }
}

mutation {
  leaveGameRoom {
    ... on Commit {
      id
      version
      session
      timestamp
      events {
        type
      }
    }
    ... on Error {
      message
    }
  }
}
{
  "authorization": "iCzKyzlDXwlMTgctwIHer8qHtYlFUnCVjigSiH/8Dmg="
}

query {
  me {
    token
    name
    status
    reinforcement
    selected
    joined
    cards
    holdings {
      name
      troop
    }
    sessionid
  }
}
{
  "authorization": "iCzKyzlDXwlMTgctwIHer8qHtYlFUnCVjigSiH/8Dmg="
}
*/