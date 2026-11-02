# AniVault — Problem & Fix Checklist

Last updated: 2026-11-02

Use this list to track remaining issues and verify fixes after each deploy.

---

## A. Recently Updated + User Progress (FIXED in code)

| # | Problem | Status | How to verify |
|---|---------|--------|---------------|
| A1 | Recently Updated cards always showed **site latest episode**, never the episode the **logged-in user** was watching | **FIXED** | Sign in → watch Ep 5 of any anime → open `/updated` → that card must show **Continue Ep 5** (or "You · Ep 5") and Watch must open Ep 5 |
| A2 | Watch button on Updated cards always jumped to latest episode | **FIXED** | Same as A1 — button now prefers incomplete user progress |
| A3 | No visual distinction between "latest on site" vs "your progress" | **FIXED** | Cards show purple CC badge (site latest) + rose "You · Ep X" / "Continue Ep X" when history exists |

**Code change:** `src/components/UpdatedAnimeCard.tsx` now reads `watchHistory` from `AuthContext` and picks the best personal episode.

**Note:** Progress only saves when the user is logged in and the native `<video>` player runs (or when iframe progress hooks fire). Pure iframe embeds may not update progress as reliably — improve later if needed.

---

## B. Data quality (do in Admin / Supabase)

| # | Problem | Status | Action |
|---|---------|--------|--------|
| B1 | Some anime may still use AniList native ID instead of **MAL ID** as `external_id` | Check | Admin → re-save anime; or SQL: fix rows where external_id ≠ MAL |
| B2 | Episodes missing working embed URLs | Check | Episode Manager → every ep needs ≥1 `https://` embed path |
| B3 | Catalog only ~171 anime | Ongoing | Import more popular + airing titles |
| B4 | Broken / dead embeds | Ongoing | Test top 15 titles on `/watch/{malId}/1` |

---

## C. Playback & player

| # | Problem | Status | Action |
|---|---------|--------|--------|
| C1 | Iframe sandbox / referrer issues on some hosts | Mostly fixed earlier | Re-test problem hosts; switch server |
| C2 | Apple / iOS iframe black screen | Handled with external prompt | Keep monitoring |
| C3 | Progress not saved for pure iframe sessions | Open | Optional: ping `saveProgress` on play/interval even for embeds |

---

## D. Auth & user features

| # | Problem | Status | Action |
|---|---------|--------|--------|
| D1 | Sign in / sign up | Working | Smoke test |
| D2 | Watchlist add/remove | Working | Smoke test |
| D3 | Watch history page | Working | `/history` shows progress bars |
| D4 | Comments / likes | Working | Needs logged-in user |

---

## E. Deploy / env

| # | Item | Status |
|---|------|--------|
| E1 | `VITE_SUPABASE_URL` + publishable key | Required |
| E2 | `SUPABASE_URL` + publishable key | Required |
| E3 | `SUPABASE_SERVICE_ROLE_KEY` (server only, never `VITE_`) | Required for admin stats |
| E4 | After env change → **redeploy** on Vercel | Remember |

---

## F. Smoke test after this deploy

1. `/api/health` → ok  
2. `/api/db/health` → tables ok  
3. Sign in  
4. Open any anime → Watch Ep 3 (or any mid episode)  
5. Wait ~15s so progress can save (native player)  
6. Go to **Recently Updated** (`/updated`)  
7. Find that anime → card should show **Continue Ep 3** / **You · Ep 3**  
8. Click Watch → lands on Ep 3  
9. Open `/history` → same episode listed with progress bar  

---

## G. Priority order if something still fails

1. Confirm user is logged in when watching  
2. Confirm `watch_history` row appears in Supabase for that user + mal_id + episode  
3. Hard-refresh `/updated` (or clear cache)  
4. If still missing: check browser console for Auth / Supabase errors  
