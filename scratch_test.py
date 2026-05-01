import sys
import os

# Add backend dir to python path
sys.path.append(os.path.join(os.path.dirname(__file__), "../..", "backend"))

from app.utils.gemini import analyze_chat_intent

result = analyze_chat_intent("Buatkan RPPH tema binatang subtema kucing", "")
print("RESULT:", result)
