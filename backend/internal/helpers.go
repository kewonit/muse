package internal

import (
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func isHostOrSuperuser(e *core.RequestEvent, lobby *core.Record) bool {
	if e.HasSuperuserAuth() {
		return true
	}
	if e.Auth == nil {
		return false
	}
	return lobby.GetString("host") == e.Auth.Id
}

func canAccessPlayer(e *core.RequestEvent, player *core.Record, lobby *core.Record) bool {
	if e.HasSuperuserAuth() {
		return true
	}
	if e.Auth == nil {
		return false
	}
	return player.GetString("user") == e.Auth.Id || lobby.GetString("host") == e.Auth.Id
}

func findPlayerByUserAndLobby(app core.App, userID string, lobbyID string) (*core.Record, error) {
	return app.FindFirstRecordByFilter(
		"players",
		"user = {:user} && lobby = {:lobby}",
		dbx.Params{"user": userID, "lobby": lobbyID},
	)
}

func findLobbyByID(app core.App, lobbyID string) (*core.Record, error) {
	return app.FindRecordById("lobbies", lobbyID)
}

func lobbyExpiresAt(lobby *core.Record) time.Time {
	expiresAt := lobby.GetDateTime("expires_at")
	if expiresAt.IsZero() {
		return time.Now().Add(time.Duration(defaultRoomTTLMinutes) * time.Minute)
	}
	return expiresAt.Time()
}

func isLobbyExpired(lobby *core.Record) bool {
	return time.Now().After(lobbyExpiresAt(lobby))
}

func maxPlayersForLobby(lobby *core.Record) int {
	maxPlayers := lobby.GetInt("max_players")
	if maxPlayers <= 0 {
		return defaultMaxPlayers
	}
	return maxPlayers
}

func choiceCountForLobby(lobby *core.Record) int {
	choiceCount := lobby.GetInt("choice_count")
	if choiceCount <= 0 {
		choiceCount = defaultChoiceCount
	}
	if choiceCount < minChoiceCount {
		return minChoiceCount
	}
	if choiceCount > maxChoiceCount {
		return maxChoiceCount
	}
	return choiceCount
}

func loadPlayerAnswers(player *core.Record) []PlayerAnswer {
	var answers []PlayerAnswer
	if err := player.UnmarshalJSONField("answers", &answers); err != nil || answers == nil {
		return []PlayerAnswer{}
	}
	return answers
}

func answerForRound(answers []PlayerAnswer, roundNumber int) (PlayerAnswer, bool) {
	for _, answer := range answers {
		if answer.RoundNumber == roundNumber {
			return answer, true
		}
	}
	return PlayerAnswer{}, false
}
