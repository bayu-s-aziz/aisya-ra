import re
from datetime import datetime
from typing import Dict, Any
from app.database import get_supabase_client

def generate_nomor_surat(ra_id: str, kode_surat: str = "RA") -> str:
    """
    Generate nomor surat otomatis dengan format: [nomor]/[kode]/[bulan]/[tahun]
    Contoh: 001/RA/III/2026
    
    Args:
        ra_id: ID RA
        kode_surat: Kode surat (default: "RA")
    
    Returns:
        Nomor surat yang sudah di-format
    """
    supabase = get_supabase_client()
    now = datetime.now()
    tahun = now.year
    bulan = now.month
    
    # Bulan dalam romawi
    bulan_romawi = {
        1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI",
        7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII"
    }
    bulan_str = bulan_romawi[bulan]
    
    # Ambil atau buat counter untuk RA, tahun, dan bulan ini
    counter_response = supabase.table("nomor_surat_counter").select("*").eq(
        "ra_id", ra_id
    ).eq("tahun", tahun).eq("bulan", bulan).execute()
    
    if len(counter_response.data) == 0:
        # Buat counter baru
        new_counter = supabase.table("nomor_surat_counter").insert({
            "ra_id": ra_id,
            "tahun": tahun,
            "bulan": bulan,
            "counter": 1
        }).execute()
        
        counter_value = 1
    else:
        # Increment counter yang ada
        current_counter = counter_response.data[0]["counter"]
        counter_value = current_counter + 1
        
        supabase.table("nomor_surat_counter").update({
            "counter": counter_value
        }).eq("ra_id", ra_id).eq("tahun", tahun).eq("bulan", bulan).execute()
    
    # Format nomor: 001/RA/III/2026
    nomor_formatted = f"{counter_value:03d}/{kode_surat}/{bulan_str}/{tahun}"
    
    return nomor_formatted


def fill_template(template_content: str, parameters: Dict[str, Any]) -> str:
    """
    Isi template dengan parameters yang diberikan.
    Placeholder format: {{nama_parameter}}
    
    Args:
        template_content: Konten template dengan placeholder
        parameters: Dictionary dengan key sebagai nama parameter
    
    Returns:
        Konten yang sudah diisi
    
    Example:
        template = "Kepada Yth. {{nama_siswa}}, tanggal {{tanggal}}"
        params = {"nama_siswa": "Ahmad", "tanggal": "10 Maret 2026"}
        result = "Kepada Yth. Ahmad, tanggal 10 Maret 2026"
    """
    result = template_content
    
    # Cari semua placeholder {{...}}
    placeholders = re.findall(r'\{\{(\w+)\}\}', template_content)
    
    # Replace setiap placeholder dengan nilai dari parameters
    for placeholder in placeholders:
        if placeholder in parameters:
            # Convert value ke string jika bukan string
            value = str(parameters[placeholder])
            result = result.replace(f"{{{{{placeholder}}}}}", value)
    
    return result


def get_template_placeholders(template_content: str) -> list:
    """
    Ekstrak semua placeholder dari template.
    
    Args:
        template_content: Konten template
    
    Returns:
        List nama placeholder tanpa kurung kurawal
    
    Example:
        template = "{{nama}} di {{tempat}} pada {{tanggal}}"
        result = ["nama", "tempat", "tanggal"]
    """
    placeholders = re.findall(r'\{\{(\w+)\}\}', template_content)
    # Return unique placeholders
    return list(set(placeholders))
