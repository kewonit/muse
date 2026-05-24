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

		if lobbies.Fields.GetByName("choice_count") == nil {
			lobbies.Fields.Add(
				&core.NumberField{Name: "choice_count", Min: types.Pointer(2.0), Max: types.Pointer(5.0)},
			)
		}

		return app.Save(lobbies)
	}, func(app core.App) error {
		lobbies, err := app.FindCollectionByNameOrId("lobbies")
		if err != nil {
			return nil
		}

		lobbies.Fields.RemoveByName("choice_count")
		return app.Save(lobbies)
	})
}
