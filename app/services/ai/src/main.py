from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Bhaswara AI Service", version="1.0.0")

LanguageCode = Literal["sunda", "jawa", "bali", "bugis", "minang"]

SUPPORTED_LANGUAGES: list[LanguageCode] = ["sunda", "jawa", "bali", "bugis", "minang"]


class PronunciationRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=80)
    spoken: str = Field(..., min_length=1, max_length=120)
    language: LanguageCode = "sunda"


class PronunciationResponse(BaseModel):
    score: int
    xp_gained: int
    feedback: str
    match: bool


def normalize_text(value: str) -> str:
    cleaned = "".join(ch.lower() for ch in value if ch.isalnum() or ch.isspace())
    return " ".join(cleaned.split())


def levenshtein_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)

    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, start=1):
        current = [i]
        for j, right_char in enumerate(right, start=1):
            insert_cost = current[j - 1] + 1
            delete_cost = previous[j] + 1
            replace_cost = previous[j - 1] + (left_char != right_char)
            current.append(min(insert_cost, delete_cost, replace_cost))
        previous = current
    return previous[-1]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "bhaswara-ai"}


@app.get("/languages")
def language_list() -> dict[str, list[LanguageCode]]:
    return {"supported_languages": SUPPORTED_LANGUAGES}


@app.post("/score", response_model=PronunciationResponse)
def score_pronunciation(payload: PronunciationRequest) -> PronunciationResponse:
    target = normalize_text(payload.target)
    spoken = normalize_text(payload.spoken)

    if not target or not spoken:
        return PronunciationResponse(
            score=0,
            xp_gained=0,
            feedback="Pelafalan belum bisa dinilai. Ulangi kata dengan jelas.",
            match=False,
        )

    max_length = max(len(target), len(spoken))
    distance = levenshtein_distance(target, spoken)
    similarity = 1 - (distance / max_length) if max_length else 1
    score = max(0, min(100, round(similarity * 100)))

    if score >= 90:
        feedback = "Sangat bagus! Pengucapan kamu sudah sangat dekat dengan target."
        xp_gain = 20
        match = True
    elif score >= 75:
        feedback = "Bagus! Sedikit penyesuaian pada suku kata bisa membuat pelafalan lebih natural."
        xp_gain = 15
        match = True
    elif score >= 50:
        feedback = "Cukup dekat. Fokus pada vokal dan ritme agar lebih akurat."
        xp_gain = 10
        match = False
    elif score >= 25:
        feedback = "Masih perlu latihan. Dengarkan pengucapan target dan ulang beberapa kali."
        xp_gain = 6
        match = False
    else:
        feedback = "Pelafalan masih jauh. Coba latihan lebih perlahan dan fokus pada tiap suku kata."
        xp_gain = 3
        match = False

    return PronunciationResponse(
        score=score,
        xp_gained=xp_gain,
        feedback=feedback,
        match=match,
    )
