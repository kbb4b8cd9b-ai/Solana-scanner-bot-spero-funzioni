from fastapi import FastAPI
app=FastAPI(title="Solana Risk Scanner API")
@app.get("/api/health")
def health(): return {"status":"ok"}
