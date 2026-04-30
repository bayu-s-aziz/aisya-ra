import PyPDF2

pdf_path = r'C:\projects\aisya-ra\docs\skripsi\Bab_IV_Metodologi_Penelitian.pdf'
txt_path = r'C:\projects\aisya-ra\backend\pdf_content.txt'

try:
    reader = PyPDF2.PdfReader(pdf_path)
    with open(txt_path, 'w', encoding='utf-8') as f:
        for page in reader.pages:
            text = page.extract_text()
            if text:
                f.write(text + '\n')
    print("Success")
except Exception as e:
    print("Error:", e)
