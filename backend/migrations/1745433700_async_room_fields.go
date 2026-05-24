package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(app core.App) error {
		lobbies, err := app.FindCollectionByNameOrId("lobbies")
		if err != nil {
			return err
		}
		lobbies.Fields.Add(
			&core.SelectField{Name: "status", Required: true, Values: []string{"waiting", "countdown", "playing", "reveal", "finished"}, MaxSelect: 1},
			&core.NumberField{Name: "max_players", Min: types.Pointer(1.0), Max: types.Pointer(100.0)},
		)
		if err := app.Save(lobbies); err != nil {
			return err
		}

		players, err := app.FindCollectionByNameOrId("players")
		if err != nil {
			return err
		}
		players.ListRule = types.Pointer("@request.auth.id != ''")
		players.ViewRule = types.Pointer("@request.auth.id != ''")
		players.Fields.Add(
			&core.SelectField{Name: "status", Values: []string{"waiting", "ready", "spectating", "playing", "finished"}, MaxSelect: 1},
			&core.NumberField{Name: "current_round", Min: types.Pointer(0.0)},
			&core.DateField{Name: "round_started_at"},
			&core.DateField{Name: "finished_at"},
			&core.JSONField{Name: "answers"},
		)
		if err := app.Save(players); err != nil {
			return err
		}

		return nil
	}, func(app core.App) error {
		lobbies, err := app.FindCollectionByNameOrId("lobbies")
		if err == nil {
			lobbies.Fields.RemoveByName("max_players")
			_ = app.Save(lobbies)
		}

		players, err := app.FindCollectionByNameOrId("players")
		if err == nil {
			players.ListRule = types.Pointer("lobby.host = @request.auth.id || user = @request.auth.id")
			players.ViewRule = types.Pointer("lobby.host = @request.auth.id || user = @request.auth.id")
			players.Fields.RemoveByName("current_round")
			players.Fields.RemoveByName("round_started_at")
			players.Fields.RemoveByName("finished_at")
			players.Fields.RemoveByName("answers")
			_ = app.Save(players)
		}

		return nil
	})
}
