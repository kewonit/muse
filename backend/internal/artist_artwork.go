package internal

import (
	"encoding/json"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

var (
	artistArtworkURLPattern = regexp.MustCompile(`https://is[0-9]+-ssl\.mzstatic\.com/image/thumb/AMCArtistImages[^"'<> ]+\.(?:png|jpg|webp)`)
	artworkSizePattern      = regexp.MustCompile(`/[0-9]+x[0-9]+[a-z]*\.(png|jpg|webp)$`)
	musicGroupSchemaPattern = regexp.MustCompile(`(?is)<script[^>]+id=["']?schema:music-group["']?[^>]*>(.*?)</script>`)
	metaImagePattern        = regexp.MustCompile(`(?is)<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']`)
)

func getArtistArtwork(e *core.RequestEvent) error {
	artistURL := strings.TrimSpace(e.Request.URL.Query().Get("url"))
	if artistURL == "" {
		return e.BadRequestError("Missing artist URL", nil)
	}

	parsedURL, err := url.Parse(artistURL)
	if err != nil || parsedURL.Scheme != "https" || parsedURL.Hostname() != "music.apple.com" {
		return e.BadRequestError("Invalid artist URL", nil)
	}

	request, err := http.NewRequest(http.MethodGet, artistURL, nil)
	if err != nil {
		return e.BadRequestError("Invalid artist URL", err)
	}
	request.Header.Set("User-Agent", "Muse/1.0")

	client := http.Client{Timeout: 4 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return e.JSON(http.StatusOK, map[string]string{"artworkUrl": ""})
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return e.JSON(http.StatusOK, map[string]string{"artworkUrl": ""})
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024))
	if err != nil {
		return e.JSON(http.StatusOK, map[string]string{"artworkUrl": ""})
	}

	return e.JSON(http.StatusOK, map[string]string{
		"artworkUrl": extractArtistArtworkURL(string(body)),
	})
}

func extractArtistArtworkURL(pageHTML string) string {
	normalizedHTML := html.UnescapeString(strings.ReplaceAll(pageHTML, `\u002F`, "/"))

	if artworkURL := extractSchemaArtistImage(normalizedHTML); artworkURL != "" {
		return normalizeArtworkSize(artworkURL)
	}
	if artworkURL := extractMetaImage(normalizedHTML); artworkURL != "" {
		return normalizeArtworkSize(artworkURL)
	}

	match := artistArtworkURLPattern.FindString(normalizedHTML)
	if match == "" {
		return ""
	}
	return normalizeArtworkSize(match)
}

func extractSchemaArtistImage(pageHTML string) string {
	match := musicGroupSchemaPattern.FindStringSubmatch(pageHTML)
	if len(match) < 2 {
		return ""
	}

	var payload struct {
		Image string `json:"image"`
	}
	if err := json.Unmarshal([]byte(match[1]), &payload); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.Image)
}

func extractMetaImage(pageHTML string) string {
	match := metaImagePattern.FindStringSubmatch(pageHTML)
	if len(match) < 2 {
		return ""
	}
	return strings.TrimSpace(match[1])
}

func normalizeArtworkSize(artworkURL string) string {
	if artworkURL == "" {
		return ""
	}
	return artworkSizePattern.ReplaceAllString(artworkURL, `/486x486bb.$1`)
}
