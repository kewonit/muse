package internal

import (
	"log"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/tools/types"
)

func registerCleanupJobs(app *pocketbase.PocketBase) {
	app.Cron().MustAdd("expire_rooms", "*/5 * * * *", func() {
		expireOpenRooms(app)
		deleteRetainedRooms(app)
	})
}

func expireOpenRooms(app *pocketbase.PocketBase) {
	records, err := app.FindRecordsByFilter(
		"lobbies",
		"expires_at < {:now} && status != {:finished}",
		"",
		200,
		0,
		dbx.Params{
			"now":      types.NowDateTime(),
			"finished": lobbyStatusFinished,
		},
	)
	if err != nil {
		log.Printf("room expiry query failed: %v", err)
		return
	}

	for _, lobby := range records {
		lobby.Set("status", lobbyStatusFinished)
		if err := app.Save(lobby); err != nil {
			log.Printf("room expiry save failed for %s: %v", lobby.Id, err)
		}
	}
}

func deleteRetainedRooms(app *pocketbase.PocketBase) {
	deleteBefore := time.Now().Add(-expiredRoomRetention)
	records, err := app.FindRecordsByFilter(
		"lobbies",
		"expires_at < {:deleteBefore}",
		"",
		200,
		0,
		dbx.Params{"deleteBefore": deleteBefore},
	)
	if err != nil {
		log.Printf("room cleanup query failed: %v", err)
		return
	}

	for _, lobby := range records {
		if err := app.Delete(lobby); err != nil {
			log.Printf("room cleanup delete failed for %s: %v", lobby.Id, err)
		}
	}
}
