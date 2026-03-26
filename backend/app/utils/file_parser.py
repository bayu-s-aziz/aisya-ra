from typing import BinaryIO
import io
from PyPDF2 import PdfReader
from docx import Document

def parse_pdf(file_content: bytes) -> str:
    """
    Extract text dari file PDF.
    """
    try:
        pdf_file = io.BytesIO(file_content)
        reader = PdfReader(pdf_file)
        
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        
        return "\n".join(text_parts)
    except Exception as e:
        raise Exception(f"Failed to parse PDF: {str(e)}")


def parse_docx(file_content: bytes) -> str:
    """
    Extract text dari file DOCX.
    """
    try:
        docx_file = io.BytesIO(file_content)
        doc = Document(docx_file)
        
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        
        return "\n".join(text_parts)
    except Exception as e:
        raise Exception(f"Failed to parse DOCX: {str(e)}")


def parse_txt(file_content: bytes) -> str:
    """
    Extract text dari file TXT.
    """
    try:
        # Try UTF-8 first, fallback to latin-1
        try:
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            return file_content.decode('latin-1')
    except Exception as e:
        raise Exception(f"Failed to parse TXT: {str(e)}")


def parse_file(filename: str, file_content: bytes) -> str:
    """
    Parse file berdasarkan ekstensinya.
    """
    filename_lower = filename.lower()
    
    if filename_lower.endswith('.pdf'):
        return parse_pdf(file_content)
    elif filename_lower.endswith('.docx'):
        return parse_docx(file_content)
    elif filename_lower.endswith('.txt'):
        return parse_txt(file_content)
    else:
        raise ValueError(f"Unsupported file type: {filename}. Only PDF, DOCX, and TXT are supported.")
