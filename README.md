# junctionBlog

Minimal command-console blog for **junction.today** and **junction.website**.
Angular frontend. Blog API is designed for **[junctionBack](https://github.com/ancqit/junctionBack)** (`/blog/*`). OTP login uses the existing junctionBack phone auth.

## Product

- Matrix / command-tool UI: `enter` → name + number → `post` input against a **required junction**.
- Users are numbered. Nametags (`name#1042`) refine search; **blog number** is primary.
- Posting works without a full profile (name is enough). Mobile OTP is optional.
- Profile is three questions: sleep/wake, settable activity, then a 24h routine with hour dials, rest days, active vs rest day, clubbed hours, remaining/active/rest footer, week → month/year estimate.
- Share links: `https://junction.today?blog=<n>` and `https://junction.website?blog=<n>` so those apps can open an entry and add content.

## Run frontend

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:4200`.

Console commands: `help`, `enter`, `post`, `find <blog# or text>`, `tag <nametag>`, `profile`, `share <blog#>`, `open <blog#>`, `login`.

Until junctionBack has `/blog` routes, the UI stores entries in the browser (and in the local API below).

## Local blog API (same contract as junctionBack)

```bash
pip install -r server/requirements.txt
uvicorn server.main:app --reload --port 8010
```

`frontend/proxy.conf.json` sends `/api/blog` to this process and other `/api` calls to `https://junctionback.onrender.com`.

## Merge into junctionBack

Copy `patches/junctionBack-files/app/blog.py` into junctionBack, add collections in `app/database.py`, include the router in `app/main.py`. See `patches/junctionBack-files/NOTES.txt`.

Add the Vercel origin to junctionBack CORS.

## Deploy on Vercel

Root `vercel.json` builds `frontend/` and publishes `frontend/dist/frontend/browser`, same pattern as jWeb / jtoday.

1. Root Directory = repository root
2. `/api/*` rewrites to `https://junctionback.onrender.com`
3. Angular routes rewrite to `index.html`

OTP needs junctionBack `GCP_IDENTITY_PLATFORM_API_KEY` (or OTP debug) and `JWT_SECRET`.
