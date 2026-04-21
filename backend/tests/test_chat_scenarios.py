import pytest

from app.routers.chat import _classify_chat_route


@pytest.mark.parametrize(
    "query,expected_route",
    [
        ("Tolong catat Budi izin hari ini", "admin_action"),
        ("Pindahkan Anisa dari kelompok A ke kelompok B", "admin_action"),
        ("Tolong daftarkan siswa baru Zahra ke kelas A", "admin_action"),
        ("Siapa kepala RA sekarang?", "operational_query"),
        ("Nama sekolah ini apa?", "operational_query"),
        ("Tahun ajaran aktif sekarang apa?", "operational_query"),
        ("Tampilkan kalender pendidikan minggu ini", "operational_query"),
        ("Daftar guru yang ada", "operational_query"),
        ("Daftar template surat", "operational_query"),
        ("Rekap presensi hari ini lalu tampilkan yang belum dicatat", "multi_step"),
        ("Jumlah siswa kelompok B lalu sebutkan wali kelasnya", "multi_step"),
    ],
)
def test_chat_route_scenarios(query, expected_route):
    assert _classify_chat_route(query) == expected_route
