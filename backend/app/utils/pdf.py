import json

from weasyprint import HTML


def generate_pdf(html_content: str) -> bytes:
  return HTML(string=html_content).write_pdf()


def generate_rpph_pdf(konten_json: dict) -> bytes:
    pretty_content = json.dumps(konten_json, ensure_ascii=False, indent=2)
    html = f"""
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {{ font-family: Arial, sans-serif; margin: 24px; }}
          h1 {{ font-size: 20px; margin-bottom: 16px; }}
          pre {{
            background: #f5f5f5;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 16px;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 12px;
            line-height: 1.4;
          }}
        </style>
      </head>
      <body>
        <h1>RPPH</h1>
        <pre>{pretty_content}</pre>
      </body>
    </html>
    """
    return HTML(string=html).write_pdf()
