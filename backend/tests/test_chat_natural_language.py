from datetime import date, timedelta

from app.routers.chat import (
    _apply_custom_vocabulary,
    _classify_chat_route,
    _detect_admin_action_intent,
    _extract_target_kelompok_name,
    _extract_attendance_records,
    _is_explicit_action_request,
    _looks_like_read_only_operational_query,
    _normalize_natural_language_query,
    _normalize_presensi_status,
    _parse_date_value,
    _split_multi_step_commands,
)


def test_normalize_natural_language_query_handles_typo_and_slang():
    normalized = _normalize_natural_language_query(
        "Tlg catetin presnsi siswa yg gak msuk hr ni, ijin"
    )

    assert "tolong" in normalized
    assert "catat" in normalized
    assert "presensi" in normalized
    assert "tidak" in normalized
    assert "masuk" in normalized
    assert "hari" in normalized
    assert "ini" in normalized
    assert "izin" in normalized


def test_detect_intent_for_attendance_with_mixed_language():
    intent = _detect_admin_action_intent("Tlg catetin Budi gak masuk hr ni, ijin")
    assert intent == "mark_attendance"


def test_detect_intent_for_create_student_with_typo():
    intent = _detect_admin_action_intent("Tolong tmbahin murid Sinta ke kls A")
    assert intent == "create_student"


def test_detect_intent_for_transfer_student_with_slang():
    intent = _detect_admin_action_intent("Plis pindahin siswa Dimas ke kls B")
    assert intent == "transfer_student"


def test_is_explicit_action_request_handles_colloquial_words():
    assert _is_explicit_action_request("Plis bantu pindahin siswa") is True


def test_normalize_presensi_status_accepts_common_variants():
    assert _normalize_presensi_status("alpa") == "alpha"
    assert _normalize_presensi_status("ijinn") == "izin"
    assert _normalize_presensi_status("sakiiit") == "sakit"


def test_parse_date_value_handles_short_chat_forms():
    assert _parse_date_value("hr ni") == date.today().isoformat()
    assert _parse_date_value("kmrn") == (date.today() - timedelta(days=1)).isoformat()


def test_extract_attendance_records_works_with_colloquial_input():
    records = _extract_attendance_records("Tolong catetin si Budi gak masuk hr ni")

    assert len(records) == 1
    assert records[0]["nama_siswa"].lower() == "budi"
    assert records[0]["status"] == "alpha"


def test_extract_attendance_records_handles_declarative_absence_sentence():
    records = _extract_attendance_records("Hari ini Rafa tidak hadir karena sakit")

    assert len(records) == 1
    assert records[0]["nama_siswa"].lower() == "rafa"
    assert records[0]["status"] == "sakit"


def test_detect_intent_for_declarative_attendance_sentence():
    intent = _detect_admin_action_intent("Hari ini Rafa tidak hadir karena sakit")
    assert intent == "mark_attendance"


def test_reporting_query_not_classified_as_create_student_action():
    intent = _detect_admin_action_intent("Buatkan rekap absensi siswa kelompok B")
    assert intent is None


def test_read_only_operational_query_detection_for_rekap():
    assert _looks_like_read_only_operational_query("Tolong tampilkan rekap siswa kelompok A") is True


def test_extract_target_kelompok_name_from_various_phrases():
    assert _extract_target_kelompok_name("siapa wali kelas kelompok A") == "A"
    assert _extract_target_kelompok_name("berikan daftar siswa kelas B untuk imunisasi") == "B"


def test_normalize_natural_language_query_handles_school_profile_terms():
    normalized = _normalize_natural_language_query("siapa kamad di sklh ini, ta aktif apa?")

    assert "kepala" in normalized
    assert "sekolah" in normalized
    assert "tahun" in normalized
    assert "ajaran" in normalized


def test_split_multi_step_commands_handles_connectors():
    parts = _split_multi_step_commands(
        "Tampilkan jumlah siswa kelompok B lalu sebutkan wali kelasnya kemudian daftar nama siswa"
    )

    assert len(parts) == 3
    assert "jumlah siswa" in parts[0].lower()
    assert "wali kelas" in parts[1].lower()
    assert "daftar nama" in parts[2].lower()


def test_classify_chat_route_detects_multi_step():
    route = _classify_chat_route("Rekap presensi hari ini lalu tampilkan daftar yang belum dicatat")
    assert route == "multi_step"


def test_classify_chat_route_detects_operational_query():
    route = _classify_chat_route("Siapa kepala madrasah?")
    assert route == "operational_query"


def test_apply_custom_vocabulary_rewrites_phrase_and_tokens():
    vocab = {
        "phrase_map": {"nama sekolah": "nama ra"},
        "token_map": {"kamad": "kepala ra"},
    }

    rewritten = _apply_custom_vocabulary("siapa kamad dan nama sekolah ini", vocab)

    assert "kepala ra" in rewritten
    assert "nama ra" in rewritten
