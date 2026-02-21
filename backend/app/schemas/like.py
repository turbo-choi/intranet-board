from pydantic import BaseModel


class LikeStatusOut(BaseModel):
    liked: bool
    like_count: int
