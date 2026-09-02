# Apply junctionBack blog routes

This repo cannot always push to anqcit/junctionBack. Copy:

- `patches/junctionBack-files/app/blog.py` → `junctionBack/app/blog.py`

Then in `app/database.py` add:

```python
blog_entries = database["blog_entries"]
blog_profiles = database["blog_profiles"]
blog_counters = database["blog_counters"]
```

In `app/main.py` import and include `blog_router` in `_routers` (the existing loop already mounts `/api` as well).

Allow the junctionBlog Vercel origin in CORS.
