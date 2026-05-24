package internal

import "github.com/pocketbase/pocketbase/core"

func requirePlayerAccess(e *core.RequestEvent) (*core.Record, *core.Record, error) {
	playerID := e.Request.PathValue("id")
	player, err := e.App.FindRecordById("players", playerID)
	if err != nil {
		return nil, nil, e.NotFoundError("Player not found", err)
	}

	lobby, err := findLobbyByID(e.App, player.GetString("lobby"))
	if err != nil {
		return nil, nil, e.NotFoundError("Lobby not found", err)
	}

	if !canAccessPlayer(e, player, lobby) {
		return nil, nil, e.ForbiddenError("You cannot access this attempt", nil)
	}

	return player, lobby, nil
}
