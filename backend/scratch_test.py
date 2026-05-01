from app.utils.gemini import DEFAULT_MODEL_CANDIDATES
from google import genai
from app.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)
for m in DEFAULT_MODEL_CANDIDATES:
    try:
        print(f"Testing {m}...")
        response = client.models.generate_content(model=m, contents="halo")
        print(f"SUCCESS {m}: {response.text}")
        break
    except Exception as e:
        print(f"ERROR {m}: {e}")
