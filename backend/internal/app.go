package internal

import "github.com/pocketbase/pocketbase"

// Register wires all application routes, hooks, and background jobs into the PocketBase app.
func Register(app *pocketbase.PocketBase) {
	registerLobbyHooks(app)
	registerRoutes(app)
	registerCleanupJobs(app)
}
