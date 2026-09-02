# junctionBlog

Minimal blog for **junction.today** and **junction.website**.
Angular frontend. Persistence is **[junctionBack](https://github.com/ancqit/junctionBack)** `/blog/*` (Mongo). OTP uses existing junctionBack phone auth.

## Product

- Feed of blogs plus a **Create a blog** button.
- Every post must name a **junction**. Name is enough; profile is optional. Users are numbered; search is blog number first, nametag refines.
- Comments use a command line (`name` → `number` → `comment`) and append through `POST /blog/entries/{n}/comments`.
- Profile remains the 24h routine wizard.
- Share: `https://junction.today?blog=<n>` and `https://junction.website?blog=<n>`.

## Run frontend

```bash
cd frontend
npm install
npm start
```

## Local blog API (junctionBack contract)

```bash
pip install -r server/requirements.txt
uvicorn server.main:app --reload --port 8010
```

`proxy.conf.json` sends `/api/blog` here. Production Vercel rewrites `/api` to `https://junctionback.onrender.com`.

Merge `patches/junctionBack-files/app/blog.py` into junctionBack (`database.py` collections + `main.py` router). This repo cannot push to junctionBack.
