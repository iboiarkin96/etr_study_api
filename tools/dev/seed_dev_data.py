"""Seed a handful of conspectuses for the local dev loop.

Populates the DB with 8 conspectuses whose schedule rows span the four
regions the Today screen shows differently:

* 2 rows overdue           → contribute to ``schedule/summary.due_now``
* 2 rows due in the next 6h → also ``due_now``
* 2 rows due in 24h         → ``due_next_24h``
* 2 rows due in 3d / 7d     → only counted in ``total``

Slot distribution (A × 2, B × 2, C × 2, D × 2) makes ``by_slot`` non-trivial
so the strip renders with variety. Content shape (``cue_sheet`` / ``dense_paragraph``
/ ``bullets``) matches the API contract but is intentionally minimal — just
enough for the UI to render titles + slot chips.

Idempotency
-----------

Each seed row has a stable UUID drawn from the well-known
`00000000-0000-4000-8000-0000000000{02..0b}` range so re-runs produce
identical rows and `GET /conspectuses/{uuid}` accepts them (the path
param is UUID-typed). Pass ``--reset`` to wipe those known UUIDs before
re-inserting; ``--wipe-strangers`` also nukes leftover non-target users.

Prerequisites
-------------

The Telegram user this seed targets **must exist**. Log in from the Mini App
once (or POST ``initData`` to ``/api/v1/auth/telegram``) so ``users`` +
``telegram_users`` rows are created. Otherwise the script exits with a clear
error pointing you at the fix.

Usage
-----

Host-side (Postgres exposed on ``localhost:5432``)::

    DATABASE_URL=postgresql+psycopg://study_app:study_app@localhost:5432/study_app \
        python tools/dev/seed_dev_data.py

Container-side (from inside ``study-app-api``)::

    docker cp tools/dev/seed_dev_data.py study-app-api:/tmp/
    docker exec -it study-app-api python /tmp/seed_dev_data.py

Common flags::

    --telegram-user-id 12345   Target Telegram user (default matches sign_init_data.py's dev default)
    --reset                    Wipe the 10 known seed UUIDs before insert
    --wipe-strangers           Delete non-target users AND their data
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_API_ROOT = _REPO_ROOT / "services" / "api"
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from app.domain.scheduling import (  # noqa: E402
    ALGORITHM_VERSION,
    SCHEDULE_POLICY_ID,
    SCHEDULE_POLICY_VERSION,
)
from app.models.core.conspectus import (  # noqa: E402
    Conspectus,
    ConspectusEvent,
    ConspectusReviewLog,
    ConspectusSchedule,
)
from app.models.core.telegram_user import TelegramUser  # noqa: E402
from sqlalchemy import create_engine, delete, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

TELEGRAM_SYSTEM_UUID = "00000000-0000-4000-8000-000000000001"

# Fixed conspectus UUIDs so re-runs of the seed produce identical rows and
# `GET /conspectuses/{uuid}` accepts them (the endpoint validates the path
# param as a proper UUID). The 0x02..0x0b range keeps them below any real
# random UUIDs alphabetically for easy filtering in psql.
_SEED_UUIDS: tuple[str, ...] = (
    "00000000-0000-4000-8000-000000000002",  # a1
    "00000000-0000-4000-8000-000000000003",  # a2
    "00000000-0000-4000-8000-000000000004",  # a3
    "00000000-0000-4000-8000-000000000005",  # b1
    "00000000-0000-4000-8000-000000000006",  # b2
    "00000000-0000-4000-8000-000000000007",  # b3
    "00000000-0000-4000-8000-000000000008",  # c1
    "00000000-0000-4000-8000-000000000009",  # c2
    "00000000-0000-4000-8000-00000000000a",  # d1
    "00000000-0000-4000-8000-00000000000b",  # d2
)


@dataclass(frozen=True, slots=True)
class SeedRow:
    """One thoughtfully-composed conspectus for the dev fixture."""

    uuid_suffix: str
    title: str
    slot: str
    ladder_index: int
    next_review_offset: timedelta
    dense_paragraph: str
    bullets: tuple[str, ...]


# 10 realistic conspectuses — a mix of DB, distributed systems, testing, DDD
# and product topics. Each carries its own dense paragraph + bullets so the
# detail screen shows meaningful text, not a placeholder.
#
# Slot distribution: 3 × A (learning stage), 3 × B, 2 × C, 2 × D — matches a
# real-world learner's tail-heavy repertoire (many recent items, fewer mastered).
#
# Time distribution: 5 overdue (all feed due_now AND the Focus queue —
# `useFocusSession` reads /conspectuses/due which filters next_review_at <=
# NOW), 2 in the next 24h, 3 later so ScheduleSummaryStrip still shows
# non-trivial numbers.
_SEED_ROWS: tuple[SeedRow, ...] = (
    SeedRow(
        "a1",
        "Индексы в PostgreSQL — B-tree vs BRIN vs GIN",
        "A",
        0,
        timedelta(hours=-4),
        (
            "PostgreSQL шипит четыре встроенных индекс-типа. B-tree — универсальный "
            "стандарт для равенства и диапазонов. BRIN хранит только min/max блока — "
            "маленький, но подходит только для физически упорядоченных таблиц (лог, "
            "timeline). GIN индексирует «многозначные» колонки — массивы, JSONB, "
            "полнотекстовый поиск. GiST — обобщённый, под гео и full-text ранжирование."
        ),
        (
            "B-tree — дефолт, WHERE = / < / > / IN (…) / ORDER BY.",
            "BRIN — append-only таблицы, экономит место на порядок.",
            "GIN — jsonb ?, ?&, ?|, GIN на tsvector'ы для search.",
            "GiST — геоданные, ST_DWithin, KNN-запросы.",
        ),
    ),
    SeedRow(
        "a2",
        "OAuth 2.0 · Authorization Code + PKCE",
        "A",
        0,
        timedelta(hours=-2),
        (
            "PKCE (Proof Key for Code Exchange) — обязательная защита для public "
            "clients (SPA, mobile), где нельзя хранить client_secret. Клиент "
            "генерирует code_verifier (случайная строка), берёт SHA-256 → "
            "code_challenge, отправляет его на authorize. При обмене кода на токен "
            "клиент шлёт code_verifier, сервер проверяет SHA-256 совпадает — так "
            "перехваченный код нельзя использовать без исходного verifier'а."
        ),
        (
            "code_verifier — random 43-128 URL-safe chars.",
            "code_challenge = base64url(SHA-256(code_verifier)).",
            "authorize?code_challenge=X&code_challenge_method=S256.",
            "token exchange включает code_verifier.",
            "Всегда S256 — plain deprecated.",
        ),
    ),
    SeedRow(
        "a3",
        "TCP · handshake → CLOSE_WAIT",
        "A",
        0,
        timedelta(hours=-1),
        (
            "TCP connection lifecycle через 6 состояний. Установка: SYN → SYN-ACK → "
            "ACK. Закрытие асимметрично: одна сторона шлёт FIN, попадает в "
            "FIN-WAIT-1, получает ACK → FIN-WAIT-2, ждёт свой FIN. Другая сторона "
            "получает FIN и попадает в CLOSE_WAIT — прикладной уровень должен "
            "вызвать close() чтобы закрыть свою половину. Утечки CLOSE_WAIT в "
            "netstat = приложение забыло закрыть сокет."
        ),
        (
            "SYN / SYN-ACK / ACK — 3-way handshake.",
            "Активное закрытие: FIN-WAIT-1 → FIN-WAIT-2 → TIME_WAIT.",
            "Пассивное: CLOSE_WAIT → LAST_ACK → CLOSED.",
            "CLOSE_WAIT в netstat = утечка сокетов в приложении.",
        ),
    ),
    SeedRow(
        "b1",
        "SLI / SLO / SLA — как формулировать",
        "B",
        0,
        timedelta(minutes=-30),
        (
            "SLI — измеряемый показатель (доля успешных запросов, p99 latency). "
            "SLO — внутренняя цель на SLI («99.9% за 30 дней»). SLA — контракт с "
            "клиентом (обычно строже SLO). Формула error budget: (1 − SLO) × время. "
            "SLO 99.9% на месяц ≈ 43 минуты недоступности; используется бюджет — "
            "разработка релизов замедляется до восстановления."
        ),
        (
            "SLI = success_rate, latency_p99, availability.",
            "SLO = внутренняя цель на SLI в скользящем окне.",
            "SLA = юридический договор со штрафами.",
            "Error budget = 1 − SLO, тратится → freeze релизов.",
        ),
    ),
    SeedRow(
        "b2",
        "CAP теорема — что реально гарантируется",
        "B",
        0,
        timedelta(minutes=-10),
        (
            "CAP говорит: во время сетевого раздела (P) distributed-система "
            "выбирает между Consistency и Availability. В спокойное время (нет "
            "partition'а) обе гарантии сосуществуют. Практика: CA-системы = single "
            "node или synchronous replication (Postgres primary+standby). CP — "
            "consensus (etcd, ZooKeeper) отклоняет запросы при кворум-fail'е. AP — "
            "eventual consistency (Cassandra, DynamoDB), клиент видит расхождения."
        ),
        (
            "P — сетевой раздел, всегда возможен.",
            "CA не существует в реальности — это «нет partition'а».",
            "CP — consensus, отклонение при потере кворума.",
            "AP — read-your-writes только внутри одной кооординаты.",
            "PACELC уточняет: при отсутствии P выбирается Latency vs Consistency.",
        ),
    ),
    SeedRow(
        "b3",
        "Kafka log compaction",
        "B",
        0,
        timedelta(hours=20),
        (
            "Compaction — режим ретенции, где Kafka хранит **последнее** значение "
            "на ключ, а не N дней данных. Работает как upsert-лог: для событий "
            "уровня «текущее состояние» (профиль юзера, конфиг). LogCleaner "
            "периодически сливает старые сегменты, оставляя только новейшее "
            "смещение для каждого ключа. Требует ключ (не null) в каждом сообщении; "
            "null-value = tombstone → удаление после ttl."
        ),
        (
            "cleanup.policy=compact.",
            "Ключ обязателен; null-value = delete.",
            "LogCleaner работает per-partition в фоне.",
            "min.compaction.lag.ms — окно неприкосновенности.",
            "Компакция vs делит — не путать, log.roll.ms отдельно.",
        ),
    ),
    SeedRow(
        "c1",
        "Диаграмма C4 · четыре уровня",
        "C",
        0,
        timedelta(days=1, hours=-2),
        (
            "C4 (Simon Brown) — иерархия из четырёх уровней абстракции для "
            "визуализации software-architecture. Level 1 (Context) — система-точка "
            "и её акторы. Level 2 (Container) — deployable-юниты (сервисы, БД, SPA) "
            "внутри системы. Level 3 (Component) — модули внутри контейнера. "
            "Level 4 (Code) — классы / файлы, обычно генерируется автоматически."
        ),
        (
            "L1 Context: система + акторы + внешние системы.",
            "L2 Container: web/api/db/queue, показать протоколы.",
            "L3 Component: слои и модули внутри контейнера.",
            "L4 Code: UML-классы, генерится, редко рисуется вручную.",
        ),
    ),
    SeedRow(
        "c2",
        "ETR методология — 4 слота A→B→C→D",
        "C",
        0,
        timedelta(days=1, hours=4),
        (
            "Extending-Time Repetition — упрощённый SRS с 4 слотами. A (новый) → "
            "B (1 день) → C (3 дня) → D (лестница 7/14/30/60). Успешный easy "
            "продвигает; hard откатывает на предыдущий слот; forgot сбрасывает в A. "
            "Правило: retention 90%+ на easy → интервал растёт. Модель проще "
            "SM-2 (Anki), но с явными слотами, которые видит пользователь."
        ),
        (
            "4 слота — A / B / C / D, D имеет ladder 7/14/30/60d.",
            "easy → next slot, hard → previous, forgot → A.",
            "Retention >90% на easy — сигнал ослабить интервалы.",
            "vs SM-2: явные слоты видны юзеру, проще ментальная модель.",
        ),
    ),
    SeedRow(
        "d1",
        "Диатакси · четыре квадранта документации",
        "D",
        0,
        timedelta(days=3),
        (
            "Diátaxis (Daniele Procida) — таксономия документации в четыре "
            "непересекающихся типа. Tutorials — учат «делать первый раз», "
            "linear, hand-holding. How-to guides — рецепты для «знаю базу, хочу "
            "решить задачу», task-oriented. Reference — сухая спецификация "
            "(API-doc, config-options). Explanation — «почему так устроено», "
            "history + trade-offs. Каждый читатель приходит с одной из четырёх "
            "потребностей — смешивать типы в одном документе = запутать."
        ),
        (
            "Tutorials: linear, скачивать → результат, для новичков.",
            "How-to: рецепты, task-oriented, «как сделать X».",
            "Reference: спецификация, alphabetical, без нарратива.",
            "Explanation: причины и trade-offs, «почему так».",
            "Один текст = один квадрант, иначе confuse.",
        ),
    ),
    SeedRow(
        "d2",
        "Bounded Context в DDD — как разбить домен",
        "D",
        1,
        timedelta(days=7),
        (
            "Bounded Context — граница, внутри которой одна ubiquitous language. "
            "Один термин («Order») означает разные вещи в Sales-BC (заказ на "
            "оформление) и в Fulfillment-BC (заказ на упаковку). Границы "
            "проходят по: языковым конфликтам, командной ответственности, темпу "
            "изменений, консистентности данных. ContextMap показывает "
            "отношения (Partnership, Customer/Supplier, Anti-Corruption Layer, "
            "Published Language) между контекстами."
        ),
        (
            "Одна ubiquitous language внутри BC.",
            "Границы: язык, команда, темп, консистентность.",
            "ContextMap: 7 отношений между BC.",
            "ACL — переводит модели чужого BC в свой.",
            "Published Language — контракт между partners.",
        ),
    ),
)


def _uuid_for(suffix: str) -> str:
    """Look up the fixed UUID for a seed row by its short suffix (a1..d2)."""
    order = ("a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "d1", "d2")
    return _SEED_UUIDS[order.index(suffix)]


def _cue_sheet(title: str) -> dict:
    return {"prompts": [{"kind": "recall", "text": title}]}


def _resolve_database_url() -> str:
    """Read DATABASE_URL from env, defaulting to host-side compose defaults."""
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://study_app:study_app@localhost:5432/study_app",
    )


def _resolve_owner(session: Session, telegram_user_id: int) -> str:
    """Return ``client_uuid`` for the given Telegram user, or exit with help.

    The seed intentionally does NOT create the user row — that path lives in
    ``/api/v1/auth/telegram`` and creating it here would let the seed diverge
    from the real auth flow.
    """
    row = session.execute(
        select(TelegramUser.client_uuid).where(TelegramUser.telegram_user_id == telegram_user_id)
    ).scalar_one_or_none()
    if row is None:
        sys.exit(
            f"[seed] no telegram_user row for telegram_user_id={telegram_user_id}. "
            "Log in from the Mini App once (or POST initData to /api/v1/auth/telegram) "
            "so users + telegram_users get created, then re-run this script."
        )
    return row


def _wipe_seeds(session: Session) -> int:
    """Delete the known seed conspectuses (dependent tables cascade)."""
    result = session.execute(delete(Conspectus).where(Conspectus.conspectus_uuid.in_(_SEED_UUIDS)))
    session.commit()
    return result.rowcount or 0


def _insert_review_logs(
    session: Session,
    *,
    owner_client_uuid: str,
    telegram_user_id: int,
    conspectus_uuids: list[str],
) -> int:
    """Insert synthetic review-log rows so streak / yesterday / heat-map show non-zero.

    Distribution:

    * Days 1..12 back (a 12-day streak ending today) — 3 reviews per day.
    * Days 13..14 back — 0 reviews (the streak-boundary gap).
    * Days 15..60 back — mostly active, 1–5 reviews per day with some empty days.

    Tag mix approximates 85% ``easy`` for a healthy accuracy signal.
    """
    now = datetime.now(UTC)
    today_midnight = datetime(now.year, now.month, now.day, tzinfo=UTC)
    inserted = 0

    def _emit(day_offset: int, count: int, cycle_start: int) -> None:
        nonlocal inserted
        for i in range(count):
            uuid = conspectus_uuids[(cycle_start + i) % len(conspectus_uuids)]
            reviewed_at = today_midnight - timedelta(days=day_offset, hours=(i * 2 + 9))
            tag = "easy" if (day_offset + i) % 7 != 0 else "hard"
            log = ConspectusReviewLog(
                conspectus_uuid=uuid,
                owner_client_uuid=owner_client_uuid,
                tag=tag,
                slot_before="A",
                slot_after="B" if tag == "easy" else "A",
                slot_d_ladder_index_before=0,
                slot_d_ladder_index_after=0,
                schedule_revision_before=1,
                schedule_revision_after=2,
                next_review_at_before=reviewed_at,
                next_review_at_after=reviewed_at + timedelta(days=1),
                algorithm_version=ALGORITHM_VERSION,
                schedule_policy_id=SCHEDULE_POLICY_ID,
                schedule_policy_version=SCHEDULE_POLICY_VERSION,
                actor_system_user_id=str(telegram_user_id),
                actor_system_uuid=TELEGRAM_SYSTEM_UUID,
                reviewed_at=reviewed_at,
                created_at=reviewed_at,
            )
            session.add(log)
            inserted += 1

    # 12-day active streak ending today.
    for day_offset in range(12):
        _emit(day_offset, count=3, cycle_start=day_offset)

    # Streak-boundary gap on days 13..14 back.
    # (Nothing emitted — the current streak logic terminates here.)

    # Earlier activity — mostly-active pattern from days 15 to 60.
    for day_offset in range(15, 61):
        # Alternate between 0, 2, 3, 4, 5 reviews to look organic.
        pattern = (0, 2, 3, 4, 5)
        count = pattern[day_offset % len(pattern)]
        if count > 0:
            _emit(day_offset, count=count, cycle_start=day_offset)

    session.commit()
    return inserted


def _wipe_review_logs(session: Session, owner_client_uuid: str) -> int:
    """Delete every review-log row for a given owner."""
    result = session.execute(
        delete(ConspectusReviewLog).where(
            ConspectusReviewLog.owner_client_uuid == owner_client_uuid
        )
    )
    session.commit()
    return result.rowcount or 0


def _wipe_stranger_users(session: Session, owner_client_uuid: str) -> int:
    """Delete every non-target user without a telegram identity.

    Guards two invariants:

    * ``owner_client_uuid`` (the dev-target's ``users`` row) is preserved.
    * Any ``users`` row that IS bound to a ``telegram_users`` row is
      preserved — that's a real Mini App account.

    Everything else — earlier ad-hoc POST /users testing — is deleted
    together with its conspectuses, schedules, events and review logs
    (via CASCADE / soft-delete FKs) so the DB carries only one intended
    dev client.
    """
    from app.models.core.user import User

    # Collect the client_uuids we'll delete: everything that isn't the target
    # AND isn't referenced by a telegram_users row.
    stmt = select(User.client_uuid).where(
        User.client_uuid != owner_client_uuid,
        ~User.client_uuid.in_(select(TelegramUser.client_uuid)),
    )
    victims = [row for row in session.execute(stmt).scalars()]
    if not victims:
        return 0

    # Cascade the tail-heavy tables first so FKs don't complain.
    session.execute(
        delete(ConspectusReviewLog).where(ConspectusReviewLog.owner_client_uuid.in_(victims))
    )
    session.execute(delete(ConspectusEvent).where(ConspectusEvent.owner_client_uuid.in_(victims)))
    session.execute(
        delete(ConspectusSchedule).where(ConspectusSchedule.owner_client_uuid.in_(victims))
    )
    session.execute(delete(Conspectus).where(Conspectus.owner_client_uuid.in_(victims)))
    session.execute(delete(User).where(User.client_uuid.in_(victims)))
    session.commit()
    return len(victims)


def _insert_seeds(session: Session, owner_client_uuid: str, telegram_user_id: int) -> int:
    """Insert missing seed rows. Returns count of rows actually inserted."""
    inserted = 0
    now = datetime.now(UTC)
    for row in _SEED_ROWS:
        conspectus_uuid = _uuid_for(row.uuid_suffix)
        exists = session.get(Conspectus, conspectus_uuid)
        if exists is not None:
            continue

        conspectus = Conspectus(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            title=row.title,
            cue_sheet=_cue_sheet(row.title),
            cue_sheet_schema_version=1,
            dense_paragraph=row.dense_paragraph,
            bullets=list(row.bullets),
            content_version=1,
            created_at=now,
            updated_at=now,
            is_row_invalid=0,
        )
        schedule = ConspectusSchedule(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            slot=row.slot,
            slot_d_ladder_index=row.ladder_index,
            next_review_at=now + row.next_review_offset,
            schedule_revision=1,
            schedule_policy_id=SCHEDULE_POLICY_ID,
            schedule_policy_version=SCHEDULE_POLICY_VERSION,
            algorithm_version=ALGORITHM_VERSION,
            schedule_updated_at=now,
            is_row_invalid=0,
        )
        event = ConspectusEvent(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            event_type="CREATED",
            payload={"source": "dev-seed"},
            content_version_after=1,
            actor_system_user_id=str(telegram_user_id),
            actor_system_uuid=TELEGRAM_SYSTEM_UUID,
            created_at=now,
        )
        session.add_all([conspectus, schedule, event])
        inserted += 1

    session.commit()
    return inserted


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="seed_dev_data",
        description="Seed dev conspectuses so the Today screen renders non-empty state.",
    )
    parser.add_argument(
        "--telegram-user-id",
        type=int,
        default=int(os.environ.get("TMA_DEV_TELEGRAM_USER_ID", "42")),
        help=(
            "Telegram user id whose Today should be populated. Default: 42 — "
            "the same dev id sign_init_data.py and tunnels-up.sh sign initData "
            "for, so seed + auth resolve to the same owner without flags. "
            "Override via --telegram-user-id or TMA_DEV_TELEGRAM_USER_ID env."
        ),
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing seed rows (the 10 known dev UUIDs) before inserting.",
    )
    parser.add_argument(
        "--wipe-strangers",
        action="store_true",
        help=(
            "Delete every `users` row that isn't the target telegram user AND "
            "isn't referenced by a telegram_users identity. Cleans up leftovers "
            "from earlier ad-hoc POST /users testing so the DB carries only the "
            "one intended dev client."
        ),
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()

    database_url = _resolve_database_url()
    print(f"[seed] connecting to {database_url.rsplit('@', 1)[-1]}")

    engine = create_engine(database_url, future=True, pool_pre_ping=True)
    with Session(engine) as session:
        owner = _resolve_owner(session, args.telegram_user_id)
        print(f"[seed] owner client_uuid={owner} (telegram_user_id={args.telegram_user_id})")

        if args.wipe_strangers:
            wiped_users = _wipe_stranger_users(session, owner)
            print(f"[seed] wiped {wiped_users} stranger user(s) and their data")

        if args.reset:
            wiped = _wipe_seeds(session)
            print(f"[seed] wiped {wiped} pre-existing seed row(s)")
            wiped_logs = _wipe_review_logs(session, owner)
            print(f"[seed] wiped {wiped_logs} review-log row(s) for owner")

        inserted = _insert_seeds(session, owner, args.telegram_user_id)
        skipped = len(_SEED_ROWS) - inserted
        print(f"[seed] inserted {inserted} conspectus(es); skipped {skipped} (already present)")

        # Only seed review logs when we actually have conspectuses in place —
        # otherwise the foreign key on `conspectus_uuid` fails.
        conspectus_uuids = [_uuid_for(row.uuid_suffix) for row in _SEED_ROWS]
        logs = _insert_review_logs(
            session,
            owner_client_uuid=owner,
            telegram_user_id=args.telegram_user_id,
            conspectus_uuids=conspectus_uuids,
        )
        print(f"[seed] inserted {logs} review-log row(s) — 12-day streak + 60-day heatmap history")
        print(
            "[seed] done. Refresh the Mini App — Today should now show "
            f"{len(_SEED_ROWS)} due cards, a 12-day streak, and a populated heatmap."
        )


if __name__ == "__main__":
    main()
