"""Quick check: does your GEMINI_API_KEY work with the configured model?"""
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY", "")
model = os.getenv("GEMINI_MODEL", "gemma-4-31b-it")

if not api_key:
    print("GEMINI_API_KEY is not set in .env")
    exit(1)

print(f"Key   : {api_key[:8]}...{api_key[-4:]}")
print(f"Model : {model}")
print("Calling API...\n")

from google import genai

client = genai.Client(api_key=api_key)
response = client.models.generate_content(
    model=model,
    contents="Reply with exactly: API key works.",
)
print("Response:", response.text)
