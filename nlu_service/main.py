import os
import sys
import json
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

sys.path.insert(0, os.path.dirname(__file__))
from text_processor import normalize_text, detect_language, extract_entities

app = FastAPI(title="Gram Sahayak NLU Service", version="1.0.0")

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
classifier = None
label_encoder = None
vectorizer = None
embedder = None
use_embeddings = False

class ParseRequest(BaseModel):
    text: str
    session_id: Optional[str] = None

class EntityItem(BaseModel):
    type: str
    value: str

class IntentScore(BaseModel):
    intent: str
    confidence: float

class ParseResponse(BaseModel):
    intent: str
    confidence: float
    language: str
    entities: List[EntityItem]
    intents_ranked: List[IntentScore]

def load_models():
    global classifier, label_encoder, vectorizer, embedder, use_embeddings
    model_path = os.path.join(MODEL_DIR, 'intent_model.joblib')
    meta_path = os.path.join(MODEL_DIR, 'model_meta.json')
    
    if not os.path.exists(model_path):
        from train_intent_model import train
        train()

    classifier = joblib.load(model_path)
    label_encoder = joblib.load(os.path.join(MODEL_DIR, 'label_encoder.joblib'))

    if os.path.exists(meta_path):
        with open(meta_path) as f:
            meta = json.load(f)
            use_embeddings = meta.get('use_embeddings', False)

    if use_embeddings:
        try:
            from sentence_transformers import SentenceTransformer
            embedder = SentenceTransformer('intfloat/multilingual-e5-small')
        except Exception:
            use_embeddings = False

    if not use_embeddings:
        vec_path = os.path.join(MODEL_DIR, 'vectorizer.joblib')
        if os.path.exists(vec_path):
            vectorizer = joblib.load(vec_path)

@app.on_event("startup")
def startup_event():
    load_models()

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": classifier is not None,
        "use_embeddings": use_embeddings
    }

@app.get("/tts")
def text_to_speech(text: str, lang: str = "hi"):
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text parameter required")
    
    import re
    from fastapi.responses import Response
    from gtts import gTTS
    import io

    clean = re.sub(r'<[^>]*>', '', text)
    clean = re.sub(r'[•#*_`]', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()

    has_devanagari = bool(re.search(r'[\u0900-\u097F]', clean))
    tts_lang = 'hi' if (has_devanagari or lang == 'hi') else 'en'

    try:
        mp3_fp = io.BytesIO()
        tts = gTTS(text=clean[:500], lang=tts_lang, slow=False)
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return Response(content=mp3_fp.read(), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/parse", response_model=ParseResponse)
def parse_text(req: ParseRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text payload cannot be empty")

    raw_text = req.text.strip()
    norm_text = normalize_text(raw_text)
    lang = detect_language(raw_text)
    entities = extract_entities(raw_text)

    if classifier is None:
        load_models()

    if use_embeddings and embedder is not None:
        vec = embedder.encode([f"query: {norm_text}"], show_progress_bar=False)
    elif vectorizer is not None:
        vec = vectorizer.transform([norm_text])
    else:
        raise HTTPException(status_code=500, detail="NLU model feature extractor not initialized")

    probs = classifier.predict_proba(vec)[0]
    classes = label_encoder.classes_

    # Sort intents by confidence descending
    ranked_indices = np.argsort(probs)[::-1]
    ranked_intents = [
        IntentScore(intent=str(classes[idx]), confidence=round(float(probs[idx]), 4))
        for idx in ranked_indices
    ]

    top_intent = ranked_intents[0].intent
    top_conf = ranked_intents[0].confidence

    return ParseResponse(
        intent=top_intent,
        confidence=top_conf,
        language=lang,
        entities=[EntityItem(**e) for e in entities],
        intents_ranked=ranked_intents[:5]
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
