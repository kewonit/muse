package internal

import (
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func registerRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(serveEvent *core.ServeEvent) error {
		serveEvent.Router.GET("/api/muse/health", healthCheck)
		serveEvent.Router.POST("/api/muse/guest", rateLimitedGuest)
		serveEvent.Router.POST("/api/muse/profile", updateProfile).Bind(apis.RequireAuth())
		serveEvent.Router.GET("/api/muse/artist-artwork", getArtistArtwork)
		serveEvent.Router.GET("/api/muse/itunes/search", proxyITunesSearch)
		serveEvent.Router.GET("/api/muse/itunes/lookup", proxyITunesLookup)

		serveEvent.Router.POST("/api/muse/lobby/{id}/start", startLobby).Bind(apis.RequireAuth())
		serveEvent.Router.POST("/api/muse/lobby/{id}/join", joinLobby).Bind(apis.RequireAuth())
		serveEvent.Router.GET("/api/muse/lobby/{id}/scoreboard", getScoreboard)

		serveEvent.Router.POST("/api/muse/player/{id}/start", startPlayerAttempt).Bind(apis.RequireAuth())
		serveEvent.Router.POST("/api/muse/player/{id}/playing", markPlayerRoundStarted).Bind(apis.RequireAuth())
		serveEvent.Router.GET("/api/muse/player/{id}/current", getCurrentRound).Bind(apis.RequireAuth())
		serveEvent.Router.POST("/api/muse/player/{id}/guess", submitPlayerGuess).Bind(apis.RequireAuth())

		return serveEvent.Next()
	})
}
