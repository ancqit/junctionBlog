"""Local blog API matching the junctionBack /blog contract (JSON file store)."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import json

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "blog.json"
DATA_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="junction.blog local API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HourBlock(BaseModel):
    startHour: int = Field(ge=0, le=23)
    endHour: int = Field(ge=1, le=24)
    activity: str = Field(min_length=1, max_length=80)
    kind: str = Field(pattern=r"^(sleep|rest|active)$")


class DayTemplate(BaseModel):
    type: str = Field(pattern=r"^(active|rest)$")
    blocks: list[HourBlock] = Field(default_factory=list)


class BlogEntryCreate(BaseModel):
    junction: str = Field(min_length=1, max_length=160)
    city: str | None = Field(default=None, max_length=80)
    locality: str | None = Field(default=None, max_length=120)
    body: str = Field(min_length=1, max_length=8000)
    creatorName: str = Field(min_length=1, max_length=100)
    creatorNumber: str = Field(min_length=1, max_length=16)
    nameTag: str = Field(min_length=1, max_length=48)
    tags: list[str] = Field(default_factory=list)

    @field_validator("junction", "body", "creatorName", "creatorNumber", "nameTag")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class BlogEntryPatch(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


class BlogComment(BaseModel):
    id: str
    body: str
    creatorName: str
    creatorNumber: str
    nameTag: str
    createdAt: datetime


class BlogCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    creatorName: str = Field(min_length=1, max_length=100)
    creatorNumber: str = Field(min_length=1, max_length=16)
    nameTag: str = Field(min_length=1, max_length=48)


class BlogEntry(BlogEntryCreate):
    id: str
    blogNumber: int
    comments: list[BlogComment] = Field(default_factory=list)
    createdAt: datetime
    updatedAt: datetime


class BlogProfile(BaseModel):
    userNumber: str
    displayName: str
    phoneNumber: str | None = None
    nameTag: str
    sleepTime: str
    wakeTime: str
    primaryActivity: str
    restDays: list[int] = Field(default_factory=list)
    activeDay: DayTemplate
    restDay: DayTemplate
    updatedAt: datetime | None = None


def load_store() -> dict[str, Any]:
    if not DATA_PATH.exists():
        return {"entries": [], "profiles": [], "blogSeq": 2000}
    return json.loads(DATA_PATH.read_text())


def save_store(store: dict[str, Any]) -> None:
    DATA_PATH.write_text(json.dumps(store, default=str, indent=2))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "junction-blog"}


@app.post("/blog/entries", response_model=BlogEntry, status_code=status.HTTP_201_CREATED)
def create_entry(payload: BlogEntryCreate) -> BlogEntry:
    store = load_store()
    store["blogSeq"] = int(store.get("blogSeq") or 2000) + 1
    now = datetime.now(timezone.utc)
    entry = {
        **payload.model_dump(),
        "id": f"local-{store['blogSeq']}",
        "blogNumber": store["blogSeq"],
        "comments": [],
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
    }
    store["entries"].insert(0, entry)
    save_store(store)
    return BlogEntry(**entry)


@app.get("/blog/entries", response_model=list[BlogEntry])
def list_entries(
    q: str | None = Query(default=None),
    tag: str | None = Query(default=None),
) -> list[BlogEntry]:
    entries = load_store().get("entries") or []
    needle = (q or "").strip().lower()
    tag_n = (tag or "").strip().lower()
    hits: list[dict] = []
    for entry in entries:
        if needle:
            number_hit = needle.isdigit() and str(entry.get("blogNumber")) == needle
            text_hit = needle in str(entry.get("junction", "")).lower() or needle in str(entry.get("city", "")).lower() or needle in str(entry.get("locality", "")).lower() or needle in str(entry.get("body", "")).lower() or needle in str(entry.get("nameTag", "")).lower()
            if not (number_hit or text_hit):
                continue
        if tag_n and tag_n not in str(entry.get("nameTag", "")).lower() and tag_n not in str(entry.get("creatorName", "")).lower():
            continue
        hits.append(entry)
    return [BlogEntry(**item) for item in hits[:200]]


@app.get("/blog/entries/{blog_number}", response_model=BlogEntry)
def read_entry(blog_number: int) -> BlogEntry:
    for entry in load_store().get("entries") or []:
        if entry.get("blogNumber") == blog_number:
            return BlogEntry(**entry)
    raise HTTPException(status_code=404, detail="Blog entry not found")


@app.patch("/blog/entries/{blog_number}", response_model=BlogEntry)
def update_entry(blog_number: int, payload: BlogEntryPatch) -> BlogEntry:
    store = load_store()
    for entry in store.get("entries") or []:
        if entry.get("blogNumber") == blog_number:
            entry["body"] = payload.body.strip()
            entry["updatedAt"] = datetime.now(timezone.utc).isoformat()
            save_store(store)
            return BlogEntry(**entry)
    raise HTTPException(status_code=404, detail="Blog entry not found")


@app.post("/blog/entries/{blog_number}/comments", response_model=BlogEntry, status_code=status.HTTP_201_CREATED)
def add_comment(blog_number: int, payload: BlogCommentCreate) -> BlogEntry:
    store = load_store()
    for entry in store.get("entries") or []:
        if entry.get("blogNumber") == blog_number:
            comment = {
                "id": str(uuid4()),
                **payload.model_dump(),
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            entry.setdefault("comments", []).append(comment)
            entry["updatedAt"] = comment["createdAt"]
            save_store(store)
            return BlogEntry(**entry)
    raise HTTPException(status_code=404, detail="Blog entry not found")


@app.get("/blog/profiles", response_model=list[BlogProfile])
def list_profiles() -> list[BlogProfile]:
    return [BlogProfile(**item) for item in load_store().get("profiles") or []]


@app.get("/blog/profiles/{user_number}", response_model=BlogProfile)
def read_profile(user_number: str) -> BlogProfile:
    for profile in load_store().get("profiles") or []:
        if profile.get("userNumber") == user_number:
            return BlogProfile(**profile)
    raise HTTPException(status_code=404, detail="Profile not found")


@app.put("/blog/profiles/{user_number}", response_model=BlogProfile)
def upsert_profile(user_number: str, payload: BlogProfile) -> BlogProfile:
    store = load_store()
    data = payload.model_dump()
    data["userNumber"] = user_number
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    profiles = [item for item in store.get("profiles") or [] if item.get("userNumber") != user_number]
    profiles.insert(0, data)
    store["profiles"] = profiles
    save_store(store)
    return BlogProfile(**data)
