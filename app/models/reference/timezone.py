"""Reference model: IANA timezones dictionary."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Timezone(Base):
    """IANA timezone reference entry (seeded from ``zoneinfo``)."""

    __tablename__ = "timezones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True,
    )
    utc_offset: Mapped[int] = mapped_column(Integer, nullable=False)