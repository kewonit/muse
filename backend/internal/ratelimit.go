package internal

import (
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	window   time.Duration
	maxReq   int
}

func newRateLimiter(window time.Duration, maxRequests int) *rateLimiter {
	return &rateLimiter{
		attempts: make(map[string][]time.Time),
		window:   window,
		maxReq:   maxRequests,
	}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Clean old entries for this key
	valid := make([]time.Time, 0, len(rl.attempts[key]))
	for _, t := range rl.attempts[key] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.maxReq {
		rl.attempts[key] = valid
		return false
	}

	valid = append(valid, now)
	rl.attempts[key] = valid
	return true
}

func clientIP(r *http.Request) string {
	fwd := r.Header.Get("X-Forwarded-For")
	if fwd != "" {
		return fwd
	}
	return r.RemoteAddr
}
