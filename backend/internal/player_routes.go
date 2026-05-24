package internal

import (
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func startPlayerAttempt(e *core.RequestEvent) error {
	player, lobby, err := requirePlayerAccess(e)
	if err != nil {
		return err
	}

	if player.GetString("status") == playerStatusDone {
		return e.JSON(http.StatusOK, currentRoundResponse{
			Started:    true,
			Finished:   true,
			ServerTime: time.Now().UTC().Format(time.RFC3339Nano),
		})
	}
	if isLobbyExpired(lobby) && player.GetInt("current_round") == 0 {
		return e.BadRequestError("Room has expired", nil)
	}

	if player.GetInt("current_round") == 0 {
		player.Set("current_round", 1)
		player.Set("round_started_at", nil)
		player.Set("status", playerStatusWaiting)
		if err := e.App.Save(player); err != nil {
			return e.InternalServerError("Failed to start attempt", err)
		}
	}

	return writeCurrentRound(e, player, lobby)
}

func markPlayerRoundStarted(e *core.RequestEvent) error {
	player, lobby, err := requirePlayerAccess(e)
	if err != nil {
		return err
	}

	if player.GetString("status") == playerStatusDone {
		return e.JSON(http.StatusOK, currentRoundResponse{
			Started:    true,
			Finished:   true,
			ServerTime: time.Now().UTC().Format(time.RFC3339Nano),
		})
	}
	if player.GetInt("current_round") <= 0 {
		return e.BadRequestError("Attempt has not started", nil)
	}

	if player.GetDateTime("round_started_at").IsZero() {
		player.Set("round_started_at", types.NowDateTime())
		player.Set("status", playerStatusPlaying)
		if err := e.App.Save(player); err != nil {
			return e.InternalServerError("Failed to mark round started", err)
		}
	}

	return writeCurrentRound(e, player, lobby)
}

func getCurrentRound(e *core.RequestEvent) error {
	player, lobby, err := requirePlayerAccess(e)
	if err != nil {
		return err
	}
	return writeCurrentRound(e, player, lobby)
}

func submitPlayerGuess(e *core.RequestEvent) error {
	player, lobby, err := requirePlayerAccess(e)
	if err != nil {
		return err
	}
	if player.GetString("status") == playerStatusDone {
		return e.BadRequestError("Attempt is already finished", nil)
	}

	var payload struct {
		Guess       string `json:"guess"`
		ChoiceID    string `json:"choice_id"`
		RoundNumber int    `json:"round_number"`
	}
	if err := e.BindBody(&payload); err != nil {
		return e.BadRequestError("Invalid body", err)
	}

	roundNumber := player.GetInt("current_round")
	if roundNumber <= 0 {
		return e.BadRequestError("Attempt has not started", nil)
	}

	existingAnswers := loadPlayerAnswers(player)
	if payload.RoundNumber > 0 && payload.RoundNumber != roundNumber {
		if existingAnswer, exists := answerForRound(existingAnswers, payload.RoundNumber); exists {
			return e.JSON(http.StatusOK, guessResponse{
				Finished: player.GetString("status") == playerStatusDone,
				Answer:   existingAnswer,
			})
		}
		return e.BadRequestError("Round is no longer active", nil)
	}
	if existingAnswer, exists := answerForRound(existingAnswers, roundNumber); exists {
		return e.JSON(http.StatusOK, guessResponse{
			Finished: player.GetString("status") == playerStatusDone,
			Answer:   existingAnswer,
		})
	}

	roundRecord, err := findRoundByNumber(e.App, lobby.Id, roundNumber)
	if err != nil {
		return e.NotFoundError("Round not found", err)
	}
	choices, err := buildSongChoices(e.App, lobby, roundRecord)
	if err != nil {
		return e.InternalServerError("Failed to build choices", err)
	}
	selectedChoice, selectedChoiceFound := findChoice(choices, payload.ChoiceID)
	if payload.ChoiceID != "" && !selectedChoiceFound {
		return e.BadRequestError("Selected choice is not valid for this round", nil)
	}

	startedAt := player.GetDateTime("round_started_at")
	if startedAt.IsZero() {
		return e.BadRequestError("Round has not started", nil)
	}

	elapsedMS := time.Since(startedAt.Time()).Milliseconds()
	if elapsedMS < 0 {
		elapsedMS = 0
	}

	guess := strings.TrimSpace(payload.Guess)
	wasCorrect := false
	if payload.ChoiceID != "" {
		wasCorrect = selectedChoice.Correct
		guess = selectedChoice.TrackName
	} else {
		wasCorrect = fuzzyMatch(guess, roundRecord.GetString("song_name"))
	}
	points, isClutch := scoreChoice(wasCorrect, maxSongDuration, elapsedMS, player.GetInt("streak"))

	answer := PlayerAnswer{
		RoundNumber: roundNumber,
		Guess:       guess,
		ChoiceID:    payload.ChoiceID,
		TimeMS:      elapsedMS,
		Correct:     wasCorrect,
		Points:      points,
		IsClutch:    isClutch,
		SongName:    roundRecord.GetString("song_name"),
		ArtistName:  roundRecord.GetString("artist_name"),
		AlbumArt:    roundRecord.GetString("album_art"),
	}

	existingAnswers = append(existingAnswers, answer)
	player.Set("answers", existingAnswers)
	if wasCorrect {
		player.Set("score", player.GetInt("score")+points)
		player.Set("streak", player.GetInt("streak")+1)
	} else {
		player.Set("streak", 0)
	}

	totalRounds := lobby.GetInt("rounds_total")
	finished := roundNumber >= totalRounds
	if finished {
		player.Set("status", playerStatusDone)
		player.Set("current_round", totalRounds+1)
		player.Set("finished_at", types.NowDateTime())
	} else {
		player.Set("current_round", roundNumber+1)
		player.Set("round_started_at", nil)
		player.Set("status", playerStatusWaiting)
	}

	if err := e.App.Save(player); err != nil {
		return e.InternalServerError("Failed to save guess", err)
	}

	return e.JSON(http.StatusOK, guessResponse{
		Finished: finished,
		Answer:   answer,
	})
}

func writeCurrentRound(e *core.RequestEvent, player *core.Record, lobby *core.Record) error {
	serverTime := time.Now().UTC().Format(time.RFC3339Nano)
	if player.GetString("status") == playerStatusDone {
		return e.JSON(http.StatusOK, currentRoundResponse{
			Started:    true,
			Finished:   true,
			ServerTime: serverTime,
		})
	}

	roundNumber := player.GetInt("current_round")
	if roundNumber <= 0 {
		return e.JSON(http.StatusOK, currentRoundResponse{
			Started:     false,
			Finished:    false,
			TotalRounds: lobby.GetInt("rounds_total"),
			Duration:    lobby.GetInt("duration"),
			ServerTime:  serverTime,
		})
	}

	startedAt := player.GetDateTime("round_started_at")
	roundRecord, err := findRoundByNumber(e.App, lobby.Id, roundNumber)
	if err != nil {
		return e.NotFoundError("Round not found", err)
	}
	choices, err := buildSongChoices(e.App, lobby, roundRecord)
	if err != nil {
		return e.InternalServerError("Failed to build choices", err)
	}

	response := currentRoundResponse{
		Started:     !startedAt.IsZero(),
		Finished:    false,
		RoundID:     roundRecord.Id,
		RoundNumber: roundNumber,
		TotalRounds: lobby.GetInt("rounds_total"),
		Duration:    lobby.GetInt("duration"),
		SongURL:     roundRecord.GetString("song_url"),
		AlbumArt:    roundRecord.GetString("album_art"),
		Choices:     choices,
		ServerTime:  serverTime,
	}
	if !startedAt.IsZero() {
		response.StartedAt = startedAt.Time().UTC().Format(time.RFC3339Nano)
	}

	return e.JSON(http.StatusOK, response)
}
