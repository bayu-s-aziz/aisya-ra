from app.utils.dashboard_chat_formatter import (
    build_dashboard_text_from_endpoint,
    format_guru_dashboard_text,
    format_kepala_dashboard_text,
    is_refresh_command,
)


def test_is_refresh_command_variants():
    assert is_refresh_command("refresh") is True
    assert is_refresh_command(" /refresh ") is True
    assert is_refresh_command("Perbarui Data") is True
    assert is_refresh_command("update dashboard") is True
    assert is_refresh_command("tolong refresh sekarang") is False


def test_format_guru_dashboard_text_contains_core_sections():
    data = {
        "rpph_hari_ini": {"tanggal": "2026-03-10", "sudah_buat": True, "jumlah": 2},
        "jumlah_catatan_minggu_ini": 5,
        "siswa_tanpa_catatan_7_hari": {"jumlah": 3},
        "rekap_presensi_hari_ini": {
            "total": {"hadir": 20, "sakit": 1, "izin": 2, "alpha": 0},
            "per_kelompok": [
                {
                    "kelompok_nama": "A",
                    "hadir": 10,
                    "sakit": 0,
                    "izin": 1,
                    "alpha": 0,
                    "belum_dicatat": 0,
                }
            ],
        },
    }

    text = format_guru_dashboard_text(data, refreshed=True)

    assert text.startswith("🔄 Dashboard Guru (2026-03-10)")
    assert "✅ RPPH: Sudah dibuat (2)" in text
    assert "📝 Catatan minggu ini: 5" in text
    assert "👥 Presensi hari ini: 20 hadir, 1 sakit, 2 izin, 0 alpha" in text
    assert "🏫 Rekap per kelompok:" in text
    assert '💬 Ketik "refresh" untuk memperbarui data.' in text


def test_format_kepala_dashboard_text_contains_aggregate_sections():
    data = {
        "tanggal": "2026-03-10",
        "summary_per_guru": [
            {
                "nama": "Ibu Ani",
                "rpph_hari_ini": 1,
                "catatan_minggu_ini": 4,
                "presensi_dicatat_hari_ini": 12,
            },
            {
                "nama": "Ibu Budi",
                "rpph_hari_ini": 0,
                "catatan_minggu_ini": 1,
                "presensi_dicatat_hari_ini": 8,
            },
        ],
        "summary_per_kelas": [
            {
                "nama_kelas": "Kelompok A",
                "jumlah_siswa": 15,
                "jumlah_rpph_minggu_ini": 4,
                "jumlah_presensi_hari_ini": 14,
            }
        ],
    }

    text = format_kepala_dashboard_text(data, refreshed=False)

    assert text.startswith("📊 Dashboard Kepala RA (2026-03-10)")
    assert "👩‍🏫 Guru aktif: 2" in text
    assert "✅ RPPH hari ini: 1/2 guru (1 total)" in text
    assert "👶 Total siswa aktif: 15" in text
    assert "👨‍🏫 Ringkasan per guru:" in text
    assert "🏫 Ringkasan per kelas:" in text


def test_build_dashboard_text_uses_guru_endpoint():
    def fake_guru(current):
        assert current["ra_id"] == "ra-1"
        return {
            "data": {
                "rpph_hari_ini": {"tanggal": "2026-03-10", "sudah_buat": False, "jumlah": 0},
                "jumlah_catatan_minggu_ini": 0,
                "siswa_tanpa_catatan_7_hari": {"jumlah": 1},
                "rekap_presensi_hari_ini": {
                    "total": {"hadir": 0, "sakit": 0, "izin": 0, "alpha": 0},
                    "per_kelompok": [],
                },
            }
        }

    text = build_dashboard_text_from_endpoint(
        current={"ra_id": "ra-1", "profile": {"profile": {"role": "guru"}}},
        refreshed=False,
        guru_endpoint=fake_guru,
        kepala_endpoint=lambda current: {"data": {}},
    )
    assert "Dashboard Guru" in text


def test_build_dashboard_text_uses_kepala_endpoint():
    def fake_kepala(current):
        assert current["ra_id"] == "ra-2"
        return {
            "data": {
                "tanggal": "2026-03-10",
                "summary_per_guru": [],
                "summary_per_kelas": [],
            }
        }

    text = build_dashboard_text_from_endpoint(
        current={"ra_id": "ra-2", "profile": {"profile": {"role": "kepala_ra"}}},
        refreshed=True,
        guru_endpoint=lambda current: {"data": {}},
        kepala_endpoint=fake_kepala,
    )
    assert text.startswith("🔄 Dashboard Kepala RA")
