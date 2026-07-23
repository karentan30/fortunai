import os, uuid, httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
sessions: dict = {}

HOUR_MAP = {"子":0,"丑":1,"寅":2,"卯":3,"辰":4,"巳":5,"午":6,"未":7,"申":8,"酉":9,"戌":10,"亥":11}

class ReadingRequest(BaseModel):
    name: str
    birth_year: int
    birth_month: int
    birth_day: int
    birth_hour: str
    question: str

class UnlockRequest(BaseModel):
    session_id: str

async def generate_reading(data: ReadingRequest) -> str:
    prompt = f"""你是一位精通子平八字命理的命理师，以文言雅致风格撰写命盘解读。

命主信息：
姓名：{data.name}
生辰：{data.birth_year}年{data.birth_month}月{data.birth_day}日{data.birth_hour}时
所问：{data.question}

请撰写一份完整命盘解读，包含：
一、命格总论（3-4句，点明命主天赋气质）
二、感情姻缘（3-4句，分析桃花与婚缘）
三、事业财运（3-4句，论命主财禄事业）
四、流年大运（3-4句，近一年运势走向）

要求：文言典雅，言简意深，不超过400字。"""

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
            json={"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}], "max_tokens": 600}
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

@app.post("/api/reading")
async def create_reading(data: ReadingRequest):
    if not DEEPSEEK_API_KEY:
        raise HTTPException(500, "DEEPSEEK_API_KEY not set")
    full_text = await generate_reading(data)
    session_id = str(uuid.uuid4())
    sessions[session_id] = {"full": full_text, "name": data.name}
    preview = full_text[:200]
    return {"session_id": session_id, "preview": preview, "is_locked": True}

@app.post("/api/unlock")
async def unlock_reading(req: UnlockRequest):
    s = sessions.get(req.session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return {"full_reading": s["full"], "name": s["name"]}

@app.get("/health")
async def health():
    return {"status": "ok"}
