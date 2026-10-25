"""One-time, idempotent bootstrap of the ten existing clubs and their first admin."""

import argparse
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Club, ClubAdmin, ClubMember, User
from app.db.session import get_session_factory

CLUBS = (
    ("cuet-computer-club", "CCC", "CUET Computer Club", "Technology & programming"),
    (
        "andromeda-space-robotics",
        "ASRRO",
        "Andromeda Space and Robotics Research Org",
        "Space science & robotics",
    ),
    (
        "robo-mechatronics-association",
        "RMA",
        "Robo Mechatronics Association",
        "Mechatronics & automation",
    ),
    ("joyoddhoni", "JOYODDHONI", "Joyoddhoni", "Music & cultural expression"),
    (
        "cuet-debating-society",
        "CDS",
        "CUET Debating Society",
        "Debate & public speaking",
    ),
    ("cuet-fitness-club", "CFC", "CUET Fitness Club", "Fitness & wellbeing"),
    (
        "ieee-cuet-sb",
        "IEEE CUET SB",
        "IEEE CUET SB",
        "Engineering & professional development",
    ),
    (
        "ieee-computer-society",
        "IEEE CS",
        "IEEE Computer Society",
        "Computing & research",
    ),
    ("asme-cuet", "ASME CUET", "ASME CUET", "Mechanical engineering"),
    ("cuet-mun", "CUET MUN", "CUET MUN", "Diplomacy & global affairs"),
)


def seed_clubs(db: Session, student_id: uuid.UUID | None = None) -> int:
    if student_id is None:
        candidates = db.scalars(
            select(User).where(
                User.role == "student",
                User.is_active.is_(True),
                User.verified_at.is_not(None),
            )
        ).all()
        if len(candidates) != 1:
            raise ValueError(
                "Expected exactly one active verified student; "
                "pass --student-id to select explicitly."
            )
        student = candidates[0]
    else:
        student = db.get(User, student_id)
        if (
            student is None
            or student.role != "student"
            or not student.is_active
            or student.verified_at is None
        ):
            raise ValueError("Selected student must be active and verified.")
    for club_id, short_name, name, category in CLUBS:
        if db.get(Club, club_id) is None:
            db.add(
                Club(
                    id=club_id,
                    short_name=short_name,
                    name=name,
                    category=category,
                    tagline=f"Explore {name} at CUET.",
                    description=(
                        f"{name} is a CUET student club. Club admins can "
                        "update this starter description and publish events."
                    ),
                    activities=["Club activities to be announced"],
                )
            )
            db.flush()
        if db.get(ClubMember, (club_id, student.id)) is None:
            db.add(ClubMember(club_id=club_id, user_id=student.id))
        if db.get(ClubAdmin, (club_id, student.id)) is None:
            db.add(ClubAdmin(club_id=club_id, user_id=student.id))
    db.commit()
    return len(CLUBS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--student-id", type=uuid.UUID)
    args = parser.parse_args()
    with get_session_factory()() as session:
        count = seed_clubs(session, args.student_id)
    print(f"Seeded {count} clubs and assigned their initial student admin.")
