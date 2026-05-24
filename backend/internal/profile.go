package internal

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

var usernameCharacters = regexp.MustCompile(`[^a-zA-Z0-9 _.-]+`)

func updateProfile(e *core.RequestEvent) error {
	if e.Auth == nil {
		return e.UnauthorizedError("Auth required", nil)
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := e.BindBody(&payload); err != nil {
		return e.BadRequestError("Invalid body", err)
	}

	name, err := sanitizeDisplayName(payload.Name)
	if err != nil {
		return e.BadRequestError(err.Error(), nil)
	}

	userRecord, err := e.App.FindRecordById("users", e.Auth.Id)
	if err != nil {
		return e.NotFoundError("User not found", err)
	}
	userRecord.Set("name", name)
	if err := e.App.Save(userRecord); err != nil {
		return e.InternalServerError("Failed to save profile", err)
	}
	if err := updateOpenPlayerNames(e.App, e.Auth.Id, name); err != nil {
		return e.InternalServerError("Failed to sync player names", err)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"record": userRecord,
	})
}

func updateOpenPlayerNames(app core.App, userID string, name string) error {
	players, err := app.FindRecordsByFilter(
		"players",
		"user = {:user} && status != {:finished}",
		"",
		100,
		0,
		dbx.Params{"user": userID, "finished": playerStatusDone},
	)
	if err != nil {
		return err
	}

	for _, player := range players {
		player.Set("name", name)
		if err := app.Save(player); err != nil {
			return err
		}
	}

	return nil
}

func sanitizeDisplayName(value string) (string, error) {
	name := strings.TrimSpace(value)
	name = usernameCharacters.ReplaceAllString(name, "")
	name = strings.Join(strings.Fields(name), " ")

	if len(name) < 2 {
		return "", errInvalidDisplayName("Name must be at least 2 characters.")
	}
	if len(name) > 24 {
		name = name[:24]
	}
	if containsProfanity(name) {
		return "", errInvalidDisplayName("Pick a clean display name.")
	}

	return name, nil
}

type errInvalidDisplayName string

func (e errInvalidDisplayName) Error() string {
	return string(e)
}
