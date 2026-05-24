package internal

import (
	"errors"
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

var errRoomFull = errors.New("room is full")

func startLobby(e *core.RequestEvent) error {
	lobbyID := e.Request.PathValue("id")
	lobby, err := findLobbyByID(e.App, lobbyID)
	if err != nil {
		return e.NotFoundError("Lobby not found", err)
	}
	if !isHostOrSuperuser(e, lobby) {
		return e.ForbiddenError("Only the host can start this room", nil)
	}
	if lobby.GetString("status") != lobbyStatusWaiting {
		return e.BadRequestError("Room is already open", nil)
	}

	var payload struct {
		SongPool   []Song `json:"song_pool"`
		MaxPlayers int    `json:"max_players"`
	}
	if err := e.BindBody(&payload); err != nil {
		return e.BadRequestError("Invalid body", err)
	}

	totalRounds := lobby.GetInt("rounds_total")
	if totalRounds <= 0 {
		return e.BadRequestError("Room must have at least one round", nil)
	}

	choiceCount := choiceCountForLobby(lobby)
	requiredSongCount := totalRounds * choiceCount
	songPool, err := cleanSongPool(payload.SongPool, requiredSongCount)
	if err != nil {
		return e.BadRequestError(err.Error(), nil)
	}

	maxPlayers := payload.MaxPlayers
	if maxPlayers <= 0 {
		maxPlayers = maxPlayersForLobby(lobby)
	}
	if maxPlayers < soloMaxPlayers {
		maxPlayers = soloMaxPlayers
	}
	if maxPlayers > 100 {
		maxPlayers = 100
	}

	if err := e.App.RunInTransaction(func(txApp core.App) error {
		txLobby, err := txApp.FindRecordById("lobbies", lobbyID)
		if err != nil {
			return err
		}
		shuffledSongPool, err := createRoomRounds(txApp, txLobby, songPool)
		if err != nil {
			return err
		}

		txLobby.Set("status", lobbyStatusPlaying)
		txLobby.Set("current_round", 0)
		txLobby.Set("song_pool", shuffledSongPool)
		txLobby.Set("max_players", maxPlayers)
		txLobby.Set("choice_count", choiceCount)
		txLobby.Set("expires_at", time.Now().Add(time.Duration(defaultRoomTTLMinutes)*time.Minute))
		return txApp.Save(txLobby)
	}); err != nil {
		if errors.Is(err, errInsufficientSameArtistChoices) {
			return e.BadRequestError(err.Error(), nil)
		}
		return e.InternalServerError("Failed to start room", err)
	}

	return e.JSON(http.StatusOK, map[string]any{"success": true})
}

func joinLobby(e *core.RequestEvent) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Auth required", nil)
	}

	lobbyID := e.Request.PathValue("id")
	lobby, err := findLobbyByID(e.App, lobbyID)
	if err != nil {
		return e.NotFoundError("Lobby not found", err)
	}
	if lobby.GetString("status") == lobbyStatusWaiting {
		return e.BadRequestError("Room is not open yet", nil)
	}
	if isLobbyExpired(lobby) && lobby.GetString("status") != lobbyStatusFinished {
		return e.BadRequestError("Room has expired", nil)
	}

	if existingPlayer, err := findPlayerByUserAndLobby(e.App, e.Auth.Id, lobbyID); err == nil {
		return e.JSON(http.StatusOK, map[string]any{
			"player": existingPlayer,
			"joined": false,
		})
	}

	playersCollection, err := e.App.FindCollectionByNameOrId("players")
	if err != nil {
		return e.InternalServerError("Failed to find players collection", err)
	}

	displayName, err := sanitizeDisplayName(e.Auth.GetString("name"))
	if err != nil {
		displayName = e.Auth.GetString("username")
	}

	var player *core.Record
	if err := e.App.RunInTransaction(func(txApp core.App) error {
		players, txErr := txApp.FindRecordsByFilter(
			"players",
			"lobby = {:lobby}",
			"",
			101,
			0,
			dbx.Params{"lobby": lobbyID},
		)
		if txErr != nil {
			return txErr
		}
		if len(players) >= maxPlayersForLobby(lobby) {
			return errRoomFull
		}

		newPlayer := core.NewRecord(playersCollection)
		newPlayer.Set("lobby", lobbyID)
		newPlayer.Set("user", e.Auth.Id)
		newPlayer.Set("name", displayName)
		newPlayer.Set("score", 0)
		newPlayer.Set("streak", 0)
		newPlayer.Set("status", playerStatusWaiting)
		newPlayer.Set("current_round", 0)
		newPlayer.Set("answers", []PlayerAnswer{})
		newPlayer.Set("joined_at", types.NowDateTime())

		if txErr := txApp.Save(newPlayer); txErr != nil {
			return txErr
		}
		player = newPlayer
		return nil
	}); err != nil {
		if err == errRoomFull {
			return e.BadRequestError("Room is full", nil)
		}
		return e.InternalServerError("Failed to join room", err)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"player": player,
		"joined": true,
	})
}

func getScoreboard(e *core.RequestEvent) error {
	lobbyID := e.Request.PathValue("id")
	lobby, err := findLobbyByID(e.App, lobbyID)
	if err != nil {
		return e.NotFoundError("Lobby not found", err)
	}

	players, err := e.App.FindRecordsByFilter(
		"players",
		"lobby = {:lobby}",
		"-score,finished_at",
		100,
		0,
		dbx.Params{"lobby": lobbyID},
	)
	if err != nil {
		return e.InternalServerError("Failed to load scoreboard", err)
	}

	rows := make([]map[string]any, 0, len(players))
	for _, player := range players {
		rows = append(rows, map[string]any{
			"id":            player.Id,
			"name":          player.GetString("name"),
			"score":         player.GetInt("score"),
			"streak":        player.GetInt("streak"),
			"status":        player.GetString("status"),
			"current_round": player.GetInt("current_round"),
			"finished_at":   player.GetDateTime("finished_at"),
		})
	}

	return e.JSON(http.StatusOK, map[string]any{
		"lobby": map[string]any{
			"id":          lobby.Id,
			"code":        lobby.GetString("code"),
			"status":      lobby.GetString("status"),
			"expires_at":  lobby.GetDateTime("expires_at"),
			"max_players": maxPlayersForLobby(lobby),
		},
		"players": rows,
	})
}
