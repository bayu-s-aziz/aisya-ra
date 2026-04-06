from __future__ import annotations

import re
from datetime import date, timedelta

from fastapi import HTTPException, status

try:
    import holidays as pyholidays
except Exception:  # pragma: no cover - optional dependency in some environments
    pyholidays = None

ACADEMIC_YEAR_PATTERN = re.compile(r"^(\d{4})\/(\d{4})$")


def normalize_effective_school_days(raw_value: int | str | None) -> int:
    try:
        value = int(raw_value or 5)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hari efektif belajar harus bernilai 5 atau 6",
        ) from exc

    if value not in (5, 6):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hari efektif belajar hanya boleh 5 atau 6",
        )
    return value


def parse_academic_year_label(label: str) -> tuple[int, int]:
    normalized = (label or "").strip()
    match = ACADEMIC_YEAR_PATTERN.match(normalized)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Label tahun ajaran tidak valid untuk kalender pendidikan",
        )

    start_year = int(match.group(1))
    end_year = int(match.group(2))
    if end_year != start_year + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Label tahun ajaran tidak valid. Tahun akhir harus tahun awal + 1",
        )
    return start_year, end_year


def get_academic_year_date_range(label: str) -> tuple[date, date]:
    start_year, end_year = parse_academic_year_label(label)
    return date(start_year, 7, 1), date(end_year, 6, 30)


def get_effective_weekdays(effective_school_days: int) -> set[int]:
    normalized_days = normalize_effective_school_days(effective_school_days)
    return {0, 1, 2, 3, 4, 5} if normalized_days == 6 else {0, 1, 2, 3, 4}


def is_learning_day(target_date: date, effective_school_days: int, holiday_dates: set[date]) -> bool:
    effective_weekdays = get_effective_weekdays(effective_school_days)
    if target_date.weekday() not in effective_weekdays:
        return False
    return target_date not in holiday_dates


def filter_learning_dates(
    source_dates: list[date],
    effective_school_days: int,
    holiday_dates: set[date],
) -> list[date]:
    return [
        current_date
        for current_date in source_dates
        if is_learning_day(current_date, effective_school_days, holiday_dates)
    ]


def parse_date(value: str | date | None) -> date | None:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _iter_date_range(start_date: date, end_date: date) -> list[date]:
    total_days = (end_date - start_date).days + 1
    if total_days <= 0:
        return []
    return [start_date + timedelta(days=offset) for offset in range(total_days)]


def _build_default_semester_breaks(start_year: int, end_year: int) -> list[tuple[date, str]]:
    break_entries: list[tuple[date, str]] = []

    for holiday_date in _iter_date_range(date(start_year, 12, 24), date(end_year, 1, 1)):
        break_entries.append((holiday_date, "Libur semester ganjil"))

    for holiday_date in _iter_date_range(date(end_year, 6, 24), date(end_year, 6, 30)):
        break_entries.append((holiday_date, "Libur semester genap"))

    return break_entries


def build_kemenag_calendar_holidays(label: str) -> list[dict]:
    start_year, end_year = parse_academic_year_label(label)
    period_start, period_end = get_academic_year_date_range(label)

    event_map: dict[tuple[date, str], str] = {}

    if pyholidays is not None:
        id_holidays = pyholidays.country_holidays("ID", years=[start_year, end_year])
        for holiday_date, holiday_name in id_holidays.items():
            if period_start <= holiday_date <= period_end:
                event_map[(holiday_date, str(holiday_name))] = "Hari libur nasional"

    for holiday_date, holiday_name in _build_default_semester_breaks(start_year, end_year):
        if period_start <= holiday_date <= period_end:
            event_map[(holiday_date, holiday_name)] = "Kalender pendidikan Kemenag"

    sorted_events = sorted(event_map.items(), key=lambda item: (item[0][0], item[0][1]))
    return [
        {
            "tanggal": str(event_date),
            "nama_event": event_name,
            "keterangan": event_note,
        }
        for (event_date, event_name), event_note in sorted_events
    ]


def fetch_calendar_events(supabase, ra_id: str, tahun_ajaran_id: str) -> list[dict]:
    response = (
        supabase.table("kalender_pendidikan")
        .select("id,tahun_ajaran_id,tanggal,nama_event,is_holiday,sumber,keterangan,created_at,updated_at")
        .eq("ra_id", ra_id)
        .eq("tahun_ajaran_id", tahun_ajaran_id)
        .order("tanggal", desc=False)
        .order("nama_event", desc=False)
        .execute()
    )
    return response.data or []


def fetch_holiday_dates(
    supabase,
    ra_id: str,
    tahun_ajaran_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> set[date]:
    query = (
        supabase.table("kalender_pendidikan")
        .select("tanggal")
        .eq("ra_id", ra_id)
        .eq("tahun_ajaran_id", tahun_ajaran_id)
        .eq("is_holiday", True)
    )

    if start_date:
        query = query.gte("tanggal", str(start_date))
    if end_date:
        query = query.lte("tanggal", str(end_date))

    response = query.execute()
    holiday_dates: set[date] = set()
    for row in response.data or []:
        parsed_date = parse_date(row.get("tanggal"))
        if parsed_date:
            holiday_dates.add(parsed_date)
    return holiday_dates


def sync_kemenag_calendar(
    supabase,
    ra_id: str,
    tahun_ajaran: dict,
    created_by: str,
    replace_existing: bool = True,
) -> list[dict]:
    tahun_ajaran_id = tahun_ajaran.get("id")
    tahun_label = tahun_ajaran.get("label") or ""

    if not tahun_ajaran_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tahun ajaran tidak valid untuk sinkronisasi kalender",
        )

    events = build_kemenag_calendar_holidays(tahun_label)

    if replace_existing:
        (
            supabase.table("kalender_pendidikan")
            .delete()
            .eq("ra_id", ra_id)
            .eq("tahun_ajaran_id", tahun_ajaran_id)
            .eq("sumber", "kemenag")
            .execute()
        )

    if not events:
        return []

    payload = [
        {
            "ra_id": ra_id,
            "tahun_ajaran_id": tahun_ajaran_id,
            "tanggal": item["tanggal"],
            "nama_event": item["nama_event"],
            "is_holiday": True,
            "sumber": "kemenag",
            "keterangan": item.get("keterangan"),
            "created_by": created_by,
        }
        for item in events
    ]

    (
        supabase.table("kalender_pendidikan")
        .upsert(payload, on_conflict="tahun_ajaran_id,tanggal,nama_event,sumber")
        .execute()
    )

    return fetch_calendar_events(supabase, ra_id, tahun_ajaran_id)
