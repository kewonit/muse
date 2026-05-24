package internal

import (
	"log"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func registerLobbyHooks(app *pocketbase.PocketBase) {
	app.OnRecordCreate("lobbies").BindFunc(func(event *core.RecordEvent) error {
		if event.Record.GetString("code") == "" {
			event.Record.Set("code", randomCode(6))
		}
		if event.Record.GetDateTime("expires_at").IsZero() {
			event.Record.Set("expires_at", time.Now().Add(time.Duration(defaultRoomTTLMinutes)*time.Minute))
		}
		if event.Record.GetInt("max_players") <= 0 {
			event.Record.Set("max_players", defaultMaxPlayers)
		}
		if event.Record.GetInt("choice_count") <= 0 {
			event.Record.Set("choice_count", defaultChoiceCount)
		}
		return event.Next()
	})

	app.OnRecordEnrich("rounds").BindFunc(func(event *core.RecordEnrichEvent) error {
		if event.Record.GetBool("revealed") {
			return event.Next()
		}

		if !isRoundVisibleToRequester(event) {
			event.Record.Hide("song_name", "artist_name")
		}

		return event.Next()
	})

	app.OnRecordEnrich("lobbies").BindFunc(func(event *core.RecordEnrichEvent) error {
		if !event.RequestInfo.HasSuperuserAuth() && event.Record.GetString("status") != lobbyStatusWaiting {
			event.Record.Set("song_pool", []Song{})
		}

		return event.Next()
	})

	app.OnRecordEnrich("players").BindFunc(func(event *core.RecordEnrichEvent) error {
		if !isPlayerDetailVisibleToRequester(event) {
			event.Record.Hide("answers", "round_started_at")
		}

		return event.Next()
	})

	app.OnRecordUpdate("lobbies").BindFunc(func(event *core.RecordEvent) error {
		if event.Record.GetString("status") == lobbyStatusFinished &&
			event.Record.Original().GetString("status") != lobbyStatusFinished &&
			event.Record.GetDateTime("expires_at").IsZero() {
			event.Record.Set("expires_at", types.NowDateTime())
		}
		return event.Next()
	})
}

func isRoundVisibleToRequester(event *core.RecordEnrichEvent) bool {
	if event.RequestInfo.HasSuperuserAuth() {
		return true
	}
	if event.RequestInfo.Auth == nil {
		return false
	}

	lobby, err := event.App.FindRecordById("lobbies", event.Record.GetString("lobby"))
	if err != nil {
		log.Printf("failed to check round lobby access: %v", err)
		return false
	}

	return lobby.GetString("host") == event.RequestInfo.Auth.Id
}

func isPlayerDetailVisibleToRequester(event *core.RecordEnrichEvent) bool {
	if event.RequestInfo.HasSuperuserAuth() {
		return true
	}
	if event.RequestInfo.Auth == nil {
		return false
	}
	if event.Record.GetString("user") == event.RequestInfo.Auth.Id {
		return true
	}

	lobby, err := event.App.FindRecordById("lobbies", event.Record.GetString("lobby"))
	if err != nil {
		log.Printf("failed to check player lobby access: %v", err)
		return false
	}

	return lobby.GetString("host") == event.RequestInfo.Auth.Id
}
