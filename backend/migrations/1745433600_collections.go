package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		usersCol, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		usersId := usersCol.Id

		// lobbies collection
		lobbies := core.NewBaseCollection("lobbies")
		lobbies.ListRule = types.Pointer("@request.auth.id != ''")
		lobbies.ViewRule = types.Pointer("@request.auth.id != ''")
		lobbies.CreateRule = types.Pointer("@request.auth.id != ''")
		lobbies.UpdateRule = types.Pointer("host = @request.auth.id")
		lobbies.DeleteRule = types.Pointer("host = @request.auth.id")
		lobbies.Fields.Add(
			&core.TextField{Name: "code", Max: 10},
			&core.RelationField{Name: "host", Required: true, CollectionId: usersId, MaxSelect: 1},
			&core.SelectField{Name: "status", Required: true, Values: []string{"waiting", "countdown", "playing", "reveal", "finished"}, MaxSelect: 1},
			&core.SelectField{Name: "mode", Required: true, Values: []string{"mashup", "dictator"}, MaxSelect: 1},
			&core.NumberField{Name: "duration", Required: true, Min: types.Pointer(4.0), Max: types.Pointer(16.0)},
			&core.NumberField{Name: "rounds_total", Required: true, Min: types.Pointer(4.0), Max: types.Pointer(21.0)},
			&core.NumberField{Name: "current_round", Min: types.Pointer(0.0)},
			&core.NumberField{Name: "max_players", Min: types.Pointer(1.0), Max: types.Pointer(100.0)},
			&core.NumberField{Name: "choice_count", Min: types.Pointer(2.0), Max: types.Pointer(5.0)},
			&core.JSONField{Name: "artists"},
			&core.JSONField{Name: "song_pool"},
			&core.DateField{Name: "expires_at"},
		)
		if err := app.Save(lobbies); err != nil {
			return err
		}
		lobbiesId := lobbies.Id

		// players collection
		players := core.NewBaseCollection("players")
		players.ListRule = types.Pointer("@request.auth.id != ''")
		players.ViewRule = types.Pointer("@request.auth.id != ''")
		players.CreateRule = types.Pointer("@request.auth.id != ''")
		players.UpdateRule = types.Pointer("user = @request.auth.id || lobby.host = @request.auth.id")
		players.DeleteRule = types.Pointer("user = @request.auth.id || lobby.host = @request.auth.id")
		players.Fields.Add(
			&core.RelationField{Name: "lobby", Required: true, CollectionId: lobbiesId, MaxSelect: 1, CascadeDelete: true},
			&core.RelationField{Name: "user", Required: true, CollectionId: usersId, MaxSelect: 1},
			&core.TextField{Name: "name", Required: true, Max: 50},
			&core.NumberField{Name: "score", Min: types.Pointer(0.0)},
			&core.NumberField{Name: "streak", Min: types.Pointer(0.0)},
			&core.SelectField{Name: "status", Values: []string{"waiting", "ready", "spectating", "playing", "finished"}, MaxSelect: 1},
			&core.NumberField{Name: "current_round", Min: types.Pointer(0.0)},
			&core.DateField{Name: "round_started_at"},
			&core.DateField{Name: "finished_at"},
			&core.JSONField{Name: "artists"},
			&core.JSONField{Name: "answers"},
			&core.DateField{Name: "joined_at"},
		)
		if err := app.Save(players); err != nil {
			return err
		}

		// rounds collection
		rounds := core.NewBaseCollection("rounds")
		rounds.ListRule = types.Pointer("lobby.host = @request.auth.id || @request.auth.id != ''")
		rounds.ViewRule = types.Pointer("lobby.host = @request.auth.id || @request.auth.id != ''")
		rounds.CreateRule = types.Pointer("lobby.host = @request.auth.id")
		rounds.UpdateRule = types.Pointer("lobby.host = @request.auth.id")
		rounds.DeleteRule = types.Pointer("lobby.host = @request.auth.id")
		rounds.Fields.Add(
			&core.RelationField{Name: "lobby", Required: true, CollectionId: lobbiesId, MaxSelect: 1, CascadeDelete: true},
			&core.NumberField{Name: "round_number", Required: true, Min: types.Pointer(1.0)},
			&core.TextField{Name: "song_url", Required: true},
			&core.TextField{Name: "song_name", Required: true},
			&core.TextField{Name: "artist_name", Required: true},
			&core.URLField{Name: "album_art"},
			&core.DateField{Name: "started_at"},
			&core.JSONField{Name: "answers"},
			&core.BoolField{Name: "revealed"},
		)
		if err := app.Save(rounds); err != nil {
			return err
		}

		return nil
	}, func(app core.App) error {
		for _, name := range []string{"rounds", "players", "lobbies"} {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			if err := app.Delete(col); err != nil {
				return err
			}
		}
		return nil
	})
}
