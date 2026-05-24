package internal

import (
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

var guestRateLimiter = newRateLimiter(time.Minute, 10)

func healthCheck(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]any{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func rateLimitedGuest(e *core.RequestEvent) error {
	ip := clientIP(e.Request)
	if !guestRateLimiter.allow(ip) {
		return e.TooManyRequestsError("Too many guest requests", nil)
	}
	return createGuest(e)
}
