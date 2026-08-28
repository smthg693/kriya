import os
import pandas as pd
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from text_processor import normalize_text

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATA_PATH = os.path.join(os.path.dirname(__file__), 'labeled_utterances.csv')

def train():
    os.makedirs(MODEL_DIR, exist_ok=True)
    df = pd.read_csv(DATA_PATH)
    df['clean_text'] = df['text'].apply(normalize_text)

    X_text = df['clean_text'].tolist()
    y_raw = df['intent'].tolist()

    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_raw)

    use_embeddings = False
    embedder = None

    try:
        from sentence_transformers import SentenceTransformer
        print("⚡ Loading SentenceTransformer model (intfloat/multilingual-e5-small)...")
        embedder = SentenceTransformer('intfloat/multilingual-e5-small')
        # Add passage prefix for e5 models
        prefixed_text = [f"passage: {t}" for t in X_text]
        X = embedder.encode(prefixed_text, show_progress_bar=False)
        use_embeddings = True
        print("✅ Sentence embeddings calculated successfully.")
    except Exception as e:
        print(f"⚠️ SentenceTransformers unavailable ({e}). Using Character N-Gram TF-IDF Vectorizer fallback...")
        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4), min_df=1)
        X = vectorizer.fit_transform(X_text)
        joblib.dump(vectorizer, os.path.join(MODEL_DIR, 'vectorizer.joblib'))

    classifier = LogisticRegression(max_iter=1000, C=2.0)
    classifier.fit(X, y)

    joblib.dump(classifier, os.path.join(MODEL_DIR, 'intent_model.joblib'))
    joblib.dump(label_encoder, os.path.join(MODEL_DIR, 'label_encoder.joblib'))
    with open(os.path.join(MODEL_DIR, 'model_meta.json'), 'w') as f:
        import json
        json.dump({'use_embeddings': use_embeddings}, f)

    print(f"🎯 Model trained successfully on {len(df)} samples across {len(label_encoder.classes_)} intents!")

if __name__ == '__main__':
    train()
