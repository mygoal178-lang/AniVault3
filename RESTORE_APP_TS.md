# Restore server/app.ts (required)

`server/app.ts` on main is currently a broken stub. Restore it with these commands:

```bash
cd AniVault3
git checkout main
git pull

# 1) Restore last good full app.ts
curl -fsSL -o server/app.ts \
  "https://raw.githubusercontent.com/mygoal178-lang/AniVault3/30bd7c61fc51dddef17fa08b2aa6b81f0788d309/server/app.ts"

# 2) Apply the request-routes patch
patch -p1 < patches/app-request-routes.patch

# 3) Commit and push
git add server/app.ts
git commit -m "fix: restore full server/app.ts and register request routes"
git push origin main
```

Or apply the 4 edits manually from `patches/app-request-routes.patch`.

Also run `supabase_anime_requests.sql` in the Supabase SQL Editor.
