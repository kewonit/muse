package internal

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

func createGuest(e *core.RequestEvent) error {
	usersCollection, err := e.App.FindCollectionByNameOrId("users")
	if err != nil {
		return e.InternalServerError("Failed to find users collection", err)
	}

	username := "guest_" + randomCode(8)
	password := randomCode(24)
	displayName := "Player " + randomCode(4)

	userRecord := core.NewRecord(usersCollection)
	userRecord.Set("username", username)
	userRecord.Set("email", username+"@muse.local")
	userRecord.Set("emailVisibility", false)
	userRecord.Set("verified", true)
	userRecord.Set("password", password)
	userRecord.Set("passwordConfirm", password)
	userRecord.Set("name", displayName)

	if err := e.App.Save(userRecord); err != nil {
		return e.BadRequestError("Failed to create guest", err)
	}

	token, err := userRecord.NewAuthToken()
	if err != nil {
		return e.InternalServerError("Failed to generate token", err)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"token":  token,
		"record": userRecord,
	})
}
