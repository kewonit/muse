package internal

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

var (
	itunesHTTPClient  = &http.Client{Timeout: 8 * time.Second}
	itunesRateLimiter = newRateLimiter(time.Minute, 90)
)

func proxyITunesSearch(e *core.RequestEvent) error {
	if !itunesRateLimiter.allow("search:" + clientIP(e.Request)) {
		return e.TooManyRequestsError("Too many music search requests", nil)
	}

	query := strings.TrimSpace(e.Request.URL.Query().Get("term"))
	if len(query) < 2 {
		return e.BadRequestError("Search term must be at least two characters", nil)
	}

	targetURL := url.URL{
		Scheme: "https",
		Host:   "itunes.apple.com",
		Path:   "/search",
	}
	params := targetURL.Query()
	params.Set("term", query)
	params.Set("media", "music")
	params.Set("entity", allowedITunesValue(e.Request.URL.Query().Get("entity"), "musicArtist", "musicArtist", "song"))
	params.Set("attribute", allowedITunesValue(e.Request.URL.Query().Get("attribute"), "artistTerm", "artistTerm", "songTerm"))
	params.Set("limit", strconv.Itoa(clampedPositiveInt(e.Request.URL.Query().Get("limit"), 5, 1, 200)))
	targetURL.RawQuery = params.Encode()

	return writeITunesResponse(e, targetURL.String())
}

func proxyITunesLookup(e *core.RequestEvent) error {
	if !itunesRateLimiter.allow("lookup:" + clientIP(e.Request)) {
		return e.TooManyRequestsError("Too many music lookup requests", nil)
	}

	artistID := strings.TrimSpace(e.Request.URL.Query().Get("id"))
	if _, err := strconv.ParseInt(artistID, 10, 64); err != nil {
		return e.BadRequestError("Invalid artist id", nil)
	}

	targetURL := url.URL{
		Scheme: "https",
		Host:   "itunes.apple.com",
		Path:   "/lookup",
	}
	params := targetURL.Query()
	params.Set("id", artistID)
	params.Set("entity", allowedITunesValue(e.Request.URL.Query().Get("entity"), "song", "song"))
	params.Set("limit", strconv.Itoa(clampedPositiveInt(e.Request.URL.Query().Get("limit"), 200, 1, 200)))
	targetURL.RawQuery = params.Encode()

	return writeITunesResponse(e, targetURL.String())
}

func writeITunesResponse(e *core.RequestEvent, targetURL string) error {
	request, err := http.NewRequestWithContext(e.Request.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		return e.InternalServerError("Failed to prepare music request", err)
	}
	request.Header.Set("User-Agent", "Muse/1.0")

	response, err := itunesHTTPClient.Do(request)
	if err != nil {
		return e.BadRequestError("Music service request failed", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return e.BadRequestError(fmt.Sprintf("Music service returned %d", response.StatusCode), nil)
	}

	var payload map[string]any
	if err := json.NewDecoder(io.LimitReader(response.Body, 8<<20)).Decode(&payload); err != nil {
		return e.BadRequestError("Music service returned invalid JSON", err)
	}

	return e.JSON(http.StatusOK, payload)
}

func allowedITunesValue(value string, fallback string, allowedValues ...string) string {
	for _, allowedValue := range allowedValues {
		if value == allowedValue {
			return value
		}
	}
	return fallback
}

func clampedPositiveInt(value string, fallback int, minValue int, maxValue int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	if parsed < minValue {
		return minValue
	}
	if parsed > maxValue {
		return maxValue
	}
	return parsed
}
