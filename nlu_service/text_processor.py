import re

SCHEME_GAZETTEER = {
    'pm kisan': 'PM-Kisan Samman Nidhi',
    'pmkisan': 'PM-Kisan Samman Nidhi',
    'solar': 'PM-KUSUM Solar Pump Scheme',
    'kusum': 'PM-KUSUM Solar Pump Scheme',
    'mgnrega': 'MGNREGA Job Card Registration',
    'nrega': 'MGNREGA Job Card Registration',
    'manrega': 'MGNREGA Job Card Registration',
    'job card': 'MGNREGA Job Card Registration',
    'ayushman': 'Ayushman Bharat Card',
    'awas': 'PM Awas Housing Scheme',
    'pmay': 'PM Awas Housing Scheme',
    'ration': 'Ration Card Member Addition',
    'bhulekh': 'Land Records (Bhulekh)',
    'khatauni': 'Land Records (Bhulekh)',
    'pension': 'Old Age Pension Scheme',
    'samuh': 'Self-Help Group (NRLM) Registration',
    'shg': 'Self-Help Group (NRLM) Registration'
}

HINGLISH_MARKERS = {'kya', 'hai', 'mera', 'meri', 'kaise', 'kab', 'kahan', 'namaste', 'batao', 'chahiye', 'bhej', 'dekho', 'bataiye', 'nahi', 'mila', 'aaya', 'kist', 'paisa', 'makan', 'bimar', 'sadak', 'paani', 'bijli'}

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r'[!?.,;:()[\]{}"\']', ' ', text)
    
    # Devanagari script mappings & translations
    text = re.sub(r'(स्ट्रीट\s*लाइट|स्ट्रीटलाइट|लाइट|बिजली|खंभा)', 'streetlight electricity', text)
    text = re.sub(r'(शिकायत|तक्रार|तकरार|समस्या|दर्ज|नोंदवा|शिकायत दर्ज)', 'complaint', text)
    text = re.sub(r'(सड़क|रोड|गड्ढा)', 'road', text)
    text = re.sub(r'(पानी|जल|नल|पाइप)', 'water', text)
    text = re.sub(r'(किसान|खेती|किस्त)', 'kisan', text)
    text = re.sub(r'(आवास|मकान|घर)', 'awas', text)
    text = re.sub(r'(पेंशन|वृद्धा|विधवा)', 'pension', text)
    text = re.sub(r'(राशन|गल्ला|गेहूं)', 'ration', text)
    text = re.sub(r'(स्थिति|स्टेटस|जांच)', 'status', text)
    text = re.sub(r'(पशु|गाय|भैंस|डॉक्टर)', 'pashu', text)

    # Latin Hinglish mappings
    text = re.sub(r'\bpm\s*-?\s*kisan\b', 'pmkisan', text)
    text = re.sub(r'\b(pencion|pention)\b', 'pension', text)
    text = re.sub(r'\b(raashan|rasan)\b', 'ration', text)
    text = re.sub(r'\b(bulek|bhulekhh|khatoni|khatauni)\b', 'bhulekh', text)
    text = re.sub(r'\b(bijly|bijlii)\b', 'bijli', text)
    text = re.sub(r'\b(shikayat|sikayat|complain|takrar|takraar)\b', 'complaint', text)
    text = re.sub(r'\b(manrega|mgnrega|nrega)\b', 'mgnrega', text)
    text = re.sub(r'\b(solarpump|solar pump)\b', 'solar', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def detect_language(text: str) -> str:
    if not text:
        return 'en'
    if re.search(r'[\u0900-\u097F]', text):
        return 'hi'
    tokens = set(normalize_text(text).split())
    if tokens.intersection(HINGLISH_MARKERS):
        return 'hi'
    return 'en'

def extract_entities(text: str) -> list:
    entities = []
    norm = normalize_text(text)
    
    # ID Patterns
    cit_match = re.search(r'\b(cit-\d+)\b', norm, re.IGNORECASE)
    if cit_match:
        entities.append({'type': 'CITIZEN_ID', 'value': cit_match.group(1).upper()})

    rep_match = re.search(r'\b(rep-\d+)\b', norm, re.IGNORECASE)
    if rep_match:
        entities.append({'type': 'REPORT_ID', 'value': rep_match.group(1).upper()})

    app_match = re.search(r'\b(app-\d+)\b', norm, re.IGNORECASE)
    if app_match:
        entities.append({'type': 'APP_ID', 'value': app_match.group(1).upper()})

    # Scheme Matcher
    for key, val in SCHEME_GAZETTEER.items():
        if key in norm:
            entities.append({'type': 'SCHEME_NAME', 'value': val})
            break

    return entities
