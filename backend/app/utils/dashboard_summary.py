"""
Utility to fetch dashboard statistics and format them as a chat-friendly
multi-line text message with emoji, suitable for the 'dashboard' room type.
"""

from datetime import date, timedelta


def _start_of_week(target: date) -> date:
    return target - timedelta(days=target.weekday())


def _pluralise(n: int, singular: str, plural: str | None = None) -> str:
    if plural is None:
        plural = singular + "s"
    return f"{n} {singular if n == 1 else plural}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_dashboard_summary_text(supabase, current: dict) -> str:
    """Return a formatted emoji summary string for the current user."""
    profile_wrapper = current["profile"]
    # The profile sub-dict may be nested depending on get_current_user_profile
    profile = profile_wrapper.get("profile", profile_wrapper)
    role = (profile.get("role") or "").lower()
    ra_id = current["ra_id"]
    today = date.today()
    start_week = _start_of_week(today)
    hari_ini = today.strftime("%-d %B %Y")

    if role in {"kepala_ra", "kepala", "admin", "admin_ra"}:
        return _build_kepala_summary(supabase, ra_id, today, start_week, hari_ini)

    # Default: guru view
    guru_id = profile.get("id") or ""
    return _build_guru_summary(supabase, guru_id, ra_id, today, start_week, hari_ini)


# ---------------------------------------------------------------------------
# Internal formatters
# ---------------------------------------------------------------------------


def _build_guru_summary(supabase, guru_id: str, ra_id: str, today: date, start_week: date, hari_ini: str) -> str:
    lines: list[str] = [
        f"📊 *Dashboard Guru — {hari_ini}*",
        "",
    ]

    # --- RPPH hari ini ---
    try:
        rpph_count = (
            supabase.table("rpph")
            .select("id", count="exact")
            .eq("guru_id", guru_id)
            .eq("tanggal", str(today))
            .execute()
            .count
            or 0
        )
        lines.append(f"✅ RPPH hari ini: {'Sudah dibuat (' + str(rpph_count) + ')' if rpph_count > 0 else 'Belum dibuat'}")
    except Exception:
        lines.append("✅ RPPH hari ini: (gagal memuat)")

    # --- Catatan anekdot minggu ini ---
    try:
        catatan_count = (
            supabase.table("catatan_anekdot")
            .select("id", count="exact")
            .eq("guru_id", guru_id)
            .gte("tanggal", str(start_week))
            .lte("tanggal", str(today))
            .execute()
            .count
            or 0
        )
        lines.append(f"📝 Catatan anekdot minggu ini: {catatan_count}")
    except Exception:
        lines.append("📝 Catatan anekdot minggu ini: (gagal memuat)")

    # --- Presensi hari ini (semua kelompok di RA) ---
    try:
        kelompok_resp = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .order("nama_kelompok")
            .execute()
        )
        total_hadir = total_sakit = total_izin = total_alpha = total_belum = 0
        kelompok_lines: list[str] = []

        for kelas in kelompok_resp.data or []:
            siswa_ids = [
                s["id"]
                for s in (
                    supabase.table("siswa")
                    .select("id")
                    .eq("kelompok_id", kelas["id"])
                    .eq("status_aktif", True)
                    .execute()
                    .data
                    or []
                )
            ]
            total_siswa = len(siswa_ids)
            hadir = sakit = izin = alpha = 0

            if siswa_ids:
                for p in (
                    supabase.table("presensi")
                    .select("siswa_id,status")
                    .eq("tanggal", str(today))
                    .in_("siswa_id", siswa_ids)
                    .execute()
                    .data
                    or []
                ):
                    s = p.get("status", "")
                    if s == "hadir":
                        hadir += 1
                    elif s == "sakit":
                        sakit += 1
                    elif s == "izin":
                        izin += 1
                    elif s == "alpha":
                        alpha += 1

            belum = max(total_siswa - hadir - sakit - izin - alpha, 0)
            total_hadir += hadir
            total_sakit += sakit
            total_izin += izin
            total_alpha += alpha
            total_belum += belum

            kelompok_lines.append(
                f"   • {kelas['nama_kelompok']}: {hadir} hadir, {sakit} sakit, {izin} izin, {alpha} alpha, {belum} belum"
            )

        lines.append(f"👥 Presensi hari ini: {total_hadir} hadir, {total_sakit} sakit, {total_izin} izin, {total_alpha} alpha")
        if kelompok_lines:
            lines.extend(kelompok_lines)
        lines.append(f"⏳ Belum dicatat: {total_belum} siswa")
    except Exception:
        lines.append("👥 Presensi hari ini: (gagal memuat)")

    # --- Siswa tanpa catatan 7 hari ---
    try:
        all_siswa = [
            s
            for s in (
                supabase.table("siswa")
                .select("id,kelompok:kelompok_id(ra_id)")
                .eq("status_aktif", True)
                .execute()
                .data
                or []
            )
            if (s.get("kelompok") or {}).get("ra_id") == ra_id
        ]
        siswa_ids_all = {s["id"] for s in all_siswa}
        with_catatan = {
            r["siswa_id"]
            for r in (
                supabase.table("catatan_anekdot")
                .select("siswa_id")
                .gte("tanggal", str(today - timedelta(days=7)))
                .lte("tanggal", str(today))
                .execute()
                .data
                or []
            )
            if r.get("siswa_id")
        }
        tanpa = len(siswa_ids_all - with_catatan)
        lines.append(f"⚠️ Siswa tanpa catatan (7 hari): {tanpa} siswa")
    except Exception:
        lines.append("⚠️ Siswa tanpa catatan (7 hari): (gagal memuat)")

    lines += [
        "",
        '💬 Ketik "refresh" untuk memperbarui data.',
    ]
    return "\n".join(lines)


def _build_kepala_summary(supabase, ra_id: str, today: date, start_week: date, hari_ini: str) -> str:
    lines: list[str] = [
        f"📊 *Dashboard Kepala RA — {hari_ini}*",
        "",
    ]

    try:
        guru_list = [
            g
            for g in (
                supabase.table("profiles")
                .select("id,nama,role")
                .eq("ra_id", ra_id)
                .execute()
                .data
                or []
            )
            if (g.get("role") or "").lower() in {"guru", "guru_ra"}
        ]
        lines.append(f"👩‍🏫 Jumlah guru aktif: {len(guru_list)}")

        total_rpph_today = 0
        guru_sudah_rpph = 0
        for g in guru_list:
            c = (
                supabase.table("rpph")
                .select("id", count="exact")
                .eq("guru_id", g["id"])
                .eq("tanggal", str(today))
                .execute()
                .count
                or 0
            )
            total_rpph_today += c
            if c > 0:
                guru_sudah_rpph += 1

        lines.append(f"✅ RPPH hari ini: {guru_sudah_rpph}/{len(guru_list)} guru sudah buat ({total_rpph_today} total)")
    except Exception:
        lines.append("✅ RPPH hari ini: (gagal memuat)")

    try:
        kelas_list = (
            supabase.table("kelompok")
            .select("id,nama_kelompok")
            .eq("ra_id", ra_id)
            .order("nama_kelompok")
            .execute()
            .data
            or []
        )
        total_siswa_ra = 0
        total_hadir_ra = 0
        for kelas in kelas_list:
            siswa_ids = [
                s["id"]
                for s in (
                    supabase.table("siswa")
                    .select("id")
                    .eq("kelompok_id", kelas["id"])
                    .eq("status_aktif", True)
                    .execute()
                    .data
                    or []
                )
            ]
            total_siswa_ra += len(siswa_ids)
            if siswa_ids:
                hadir = (
                    supabase.table("presensi")
                    .select("id", count="exact")
                    .eq("tanggal", str(today))
                    .eq("status", "hadir")
                    .in_("siswa_id", siswa_ids)
                    .execute()
                    .count
                    or 0
                )
                total_hadir_ra += hadir

        lines.append(f"👥 Total siswa aktif: {total_siswa_ra}")
        lines.append(f"🏫 Hadir hari ini: {total_hadir_ra} siswa")
        lines.append(f"📚 Jumlah kelompok/kelas: {len(kelas_list)}")
    except Exception:
        lines.append("👥 Data siswa: (gagal memuat)")

    try:
        total_surat = (
            supabase.table("surat_keluar")
            .select("id", count="exact")
            .eq("ra_id", ra_id)
            .execute()
            .count
            or 0
        )
        lines.append(f"📄 Total surat keluar: {total_surat}")
    except Exception:
        pass  # surat table may not exist, skip silently

    lines += [
        "",
        '💬 Ketik "refresh" untuk memperbarui data.',
    ]
    return "\n".join(lines)
