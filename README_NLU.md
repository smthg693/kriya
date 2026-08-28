# 🌾 Gram Sahayak Production NLU Service & Pipeline

This NLU (Natural Language Understanding) pipeline replaces basic keyword matching with a production-grade machine learning classification service for rural Indian civic assistant queries.

---

## 🏛️ Architecture

```
User Utterance -> Python FastAPI NLU (:8000) -> Node.js Dialogue Manager & Confidence Gater -> Response & Actions
```

- **Language ID**: Detects Hindi (Devanagari), Hinglish (Latin-script Hindi), and English.
- **Multilingual Embeddings / Vectorizer**: Converts text into embeddings (`intfloat/multilingual-e5-small`) or character-level n-gram feature vectors.
- **Intent Classifier**: Scikit-learn `LogisticRegression` with calibrated confidence scores.
- **Entity Extraction**: Regex + Gazetteer extraction for Citizen IDs (`CIT-xxx`), Application IDs (`APP-xxx`), Report IDs (`REP-xxx`), and Scheme names.
- **Confidence Gating**:
  - `Confidence >= 0.75`: Direct execution of compliance-safe reply template & live DB status query.
  - `0.45 <= Confidence < 0.75`: Disambiguation question asking citizen to choose between top 2 predicted candidate intents.
  - `Confidence < 0.45`: Guarded fallback prompt.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd nlu_service
pip install -r requirements.txt
```

### 2. Train Intent Model
```bash
python train_intent_model.py
```

### 3. Run FastAPI Microservice
```bash
uvicorn main:app --port 8000 --reload
```

---

## 🔄 Retraining & Feedback Workflow

1. Export low-confidence queries and fallback interactions from MongoDB:
   ```bash
   node export_nlu_logs.js
   ```
2. Review `nlu_service/retrain_review.csv`, assign correct intent labels, and append rows into `nlu_service/labeled_utterances.csv`.
3. Retrain the model:
   ```bash
   cd nlu_service
   python train_intent_model.py
   ```

---

## ➕ How to Add a New Intent

1. Add 15-20 labeled example utterances in `nlu_service/labeled_utterances.csv`.
2. Add your intent response in `nlp_engine.js` `DICTIONARY` object.
3. Retrain the classifier (`python train_intent_model.py`). No routing code modifications needed!
