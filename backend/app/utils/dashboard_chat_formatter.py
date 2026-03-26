def is_refresh_command(content: str) -> bool:
    normalized = (content or "").strip().lower()
    refresh_keywords = {
        "refresh",
        "/refresh",
        "refresh dashboard",
        "update",
        "update dashboard",
        "perbarui",
        "perbarui data",
        "muat ulang",
        "reload",
    }
    return normalized in refresh_keywords


def format_guru_dashboard_text(data: dict, refreshed: bool) -> str:
    rpph = data.get("rpph_hari_ini") or {}
    catatan_count = data.get("jumlah_catatan_minggu_ini", 0)
    tanpa_catatan = (data.get("siswa_tanpa_catatan_7_hari") or {}).get("jumlah", 0)
    presensi = data.get("rekap_presensi_hari_ini") or {}
    total = presensi.get("total") or {}
    per_kelompok = presensi.get("per_kelompok") or []

    header_icon = "🔄" if refreshed else "📊"
    lines = [
        f"{header_icon} Dashboard Guru ({rpph.get('tanggal', '-')})",
        f"✅ RPPH: {'Sudah dibuat' if rpph.get('sudah_buat') else 'Belum dibuat'} ({rpph.get('jumlah', 0)})",
        f"📝 Catatan minggu ini: {catatan_count}",
        (
            "👥 Presensi hari ini: "
            f"{total.get('hadir', 0)} hadir, {total.get('sakit', 0)} sakit, "
            f"{total.get('izin', 0)} izin, {total.get('alpha', 0)} alpha"
        ),
        f"⚠️ Siswa tanpa catatan 7 hari: {tanpa_catatan}",
    ]

    if per_kelompok:
        lines.append("")
        lines.append("🏫 Rekap per kelompok:")
        for kelompok in per_kelompok:
            lines.append(
                "• "
                f"{kelompok.get('kelompok_nama', '-')} — "
                f"hadir {kelompok.get('hadir', 0)}, "
                f"sakit {kelompok.get('sakit', 0)}, "
                f"izin {kelompok.get('izin', 0)}, "
                f"alpha {kelompok.get('alpha', 0)}, "
                f"belum {kelompok.get('belum_dicatat', 0)}"
            )

    lines.append("")
    lines.append('💬 Ketik "refresh" untuk memperbarui data.')
    return "\n".join(lines)


def format_kepala_dashboard_text(data: dict, refreshed: bool) -> str:
    summary_per_guru = data.get("summary_per_guru") or []
    summary_per_kelas = data.get("summary_per_kelas") or []

    total_rpph_today = sum(item.get("rpph_hari_ini", 0) for item in summary_per_guru)
    guru_sudah_rpph = sum(1 for item in summary_per_guru if item.get("rpph_hari_ini", 0) > 0)
    total_siswa = sum(item.get("jumlah_siswa", 0) for item in summary_per_kelas)
    total_presensi = sum(item.get("jumlah_presensi_hari_ini", 0) for item in summary_per_kelas)

    header_icon = "🔄" if refreshed else "📊"
    lines = [
        f"{header_icon} Dashboard Kepala RA ({data.get('tanggal', '-')})",
        f"👩‍🏫 Guru aktif: {len(summary_per_guru)}",
        f"✅ RPPH hari ini: {guru_sudah_rpph}/{len(summary_per_guru)} guru ({total_rpph_today} total)",
        f"👶 Total siswa aktif: {total_siswa}",
        f"📍 Presensi tercatat hari ini: {total_presensi}",
        f"🏫 Jumlah kelas: {len(summary_per_kelas)}",
    ]

    if summary_per_guru:
        lines.append("")
        lines.append("👨‍🏫 Ringkasan per guru:")
        for item in summary_per_guru:
            lines.append(
                "• "
                f"{item.get('nama') or '-'} — "
                f"RPPH hari ini {item.get('rpph_hari_ini', 0)}, "
                f"catatan minggu ini {item.get('catatan_minggu_ini', 0)}, "
                f"presensi dicatat {item.get('presensi_dicatat_hari_ini', 0)}"
            )

    if summary_per_kelas:
        lines.append("")
        lines.append("🏫 Ringkasan per kelas:")
        for item in summary_per_kelas:
            lines.append(
                "• "
                f"{item.get('nama_kelas') or '-'} — "
                f"siswa {item.get('jumlah_siswa', 0)}, "
                f"RPPH minggu ini {item.get('jumlah_rpph_minggu_ini', 0)}, "
                f"presensi hari ini {item.get('jumlah_presensi_hari_ini', 0)}"
            )

    lines.append("")
    lines.append('💬 Ketik "refresh" untuk memperbarui data.')
    return "\n".join(lines)


def build_dashboard_text_from_endpoint(
    current: dict,
    refreshed: bool,
    guru_endpoint,
    kepala_endpoint,
) -> str:
    profile_wrapper = current.get("profile") or {}
    profile = profile_wrapper.get("profile", profile_wrapper)
    role = (profile.get("role") or "").lower()

    if role in {"kepala_ra", "kepala", "admin", "admin_ra"}:
        response = kepala_endpoint(current=current)
        data = (response or {}).get("data") or {}
        return format_kepala_dashboard_text(data, refreshed)

    response = guru_endpoint(current=current)
    data = (response or {}).get("data") or {}
    return format_guru_dashboard_text(data, refreshed)
