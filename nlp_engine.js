// Gram Sahayak Advanced Multi-Lingual NLP & Dialog Engine
// Features: Typo Tolerance, Intent Classification, Real-Time Database Queries, Clean Formatting (No raw stars), & Interactive Action Buttons.

async function processUserQuery(text, citizenId, dbAsync, preferredLang = 'en') {
  const input = (text || '').trim();
  const lower = input.toLowerCase()
    .replace(/[!?.,;:()[\]{}]/g, ' ')
    .replace(/\bpm\s*-?\s*kisan\b/g, 'pmkisan')
    .replace(/\b(pencion|pention)\b/g, 'pension')
    .replace(/\b(raashan|rasan)\b/g, 'ration')
    .replace(/\b(bulek|bhulekhh|khatoni|khatauni)\b/g, 'bhulekh')
    .replace(/\b(bijly|bijlii)\b/g, 'bijli')
    .replace(/\b(shikayat|sikayat|complain)\b/g, 'complaint')
    .replace(/\b(manrega|mgnrega|nrega)\b/g, 'mgnrega')
    .replace(/\b(solarpump|solar pump)\b/g, 'solar')
    .replace(/\b(chatravriti|chatravritti)\b/g, 'scholarship')
    .replace(/\b(mausam|mosam)\b/g, 'weather')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Language detection: Hindi script, Hinglish markers, or English
  const hasHindiScript = /[अ-ह]/.test(input);
  const hinglishMarkers = ['kya', 'hai', 'mera', 'meri', 'kaise', 'kab', 'kahan', 'namaste', 'batao', 'chahiye', 'bhej', 'dekho', 'bataiye'];
  const isHinglish = hinglishMarkers.some(word => lower.includes(word));
  const isHindi = preferredLang === 'hi' || hasHindiScript || isHinglish;

  // 1. LIVE DATA LOOKUP (Real-Time Database Query)
  const isStatusRequest = lower.includes('status') || lower.includes('track') || lower.includes('my app') || lower.includes('my complaint') || lower.includes('mera status') || lower.includes('meri status') || lower.includes('where is my application') || lower.includes('how far is my') || lower.includes('progress of my') || lower.includes('kya hua');
  if (isStatusRequest) {
    try {
      const queryCitizenId = citizenId || 'CIT-001';
      const reports = await dbAsync.findMany('reports', { citizen_id: queryCitizenId }, { sort: { created_at: -1 }, limit: 2 });
      const apps = await dbAsync.findMany('applications', { citizen_id: queryCitizenId }, { sort: { created_at: -1 }, limit: 2 });

      if ((!reports || reports.length === 0) && (!apps || apps.length === 0)) {
        return {
          reply: isHindi
            ? `नमस्ते! वर्तमान में आपके खाते (${queryCitizenId}) के लिए कोई सक्रिय शिकायत या आवेदन दर्ज नहीं है। आप नीचे दिए गए बटन से नया आवेदन कर सकते हैं:`
            : `Namaste! Currently there are no active complaints or applications registered for your account (${queryCitizenId}). You can submit a request below:`,
          actions: [
            { label: isHindi ? 'समस्या रिपोर्ट करें' : 'Report a Problem', tab: 'tab-report' },
            { label: isHindi ? 'योजनाएं देखें' : 'Browse Schemes', tab: 'tab-services' }
          ]
        };
      }

      let summary = isHindi ? `📊 <b>आपकी वास्तविक समय स्थिति (${queryCitizenId}):</b>\n\n` : `📊 <b>Your Real-Time Live Status (${queryCitizenId}):</b>\n\n`;
      
      if (reports && reports.length > 0) {
        summary += isHindi ? `<b>शिकायतें (Complaints):</b>\n` : `<b>Complaints:</b>\n`;
        reports.forEach(r => {
          summary += isHindi
            ? `• [${r.id}] ${r.category}: स्थिति "${r.status}" (प्राथमिकता: ${r.priority})\n`
            : `• [${r.id}] ${r.category}: Status "${r.status}" (Priority: ${r.priority})\n`;
        });
      }

      if (apps && apps.length > 0) {
        summary += isHindi ? `\n<b>योजना आवेदन (Applications):</b>\n` : `\n<b>Scheme Applications:</b>\n`;
        apps.forEach(a => {
          summary += isHindi
            ? `• [${a.id}] ${a.scheme_type}: स्थिति "${a.status}" (${a.progress_pct}% प्रगति)\n`
            : `• [${a.id}] ${a.scheme_type}: Status "${a.status}" (${a.progress_pct}% Progress)\n`;
        });
      }

      return {
        reply: summary,
        actions: [
          { label: isHindi ? 'प्रोफाइल में देखें' : 'View in Profile', tab: 'tab-profile' }
        ]
      };
    } catch (e) {
      console.error("NLP DB lookup error:", e);
    }
  }

  // 2. GREETINGS & IDENTITY
  if (/^(hi|hello|hey|namaste|नमस्ते|प्रणाम|halo|hola)/.test(lower) || lower.includes('who are you') || lower.includes('kaun ho')) {
    return {
      reply: isHindi
        ? `नमस्ते! 🙏 मैं आपका ग्राम सहायक डिजिटल मित्र हूँ। मैं पंचायत में भूलेख, राशन कार्ड, पेंशन, किसान योजनाओं (PM-Kisan), सौर पंप, मनरेगा और गांव की समस्याओं को हल करने में आपकी मदद कर सकता हूँ।`
        : `Namaste! 🙏 I am Gram Sahayak, your digital assistant for the Gram Panchayat. I can help you with land records (Bhulekh), ration cards, pensions, PM-Kisan, solar pumps, MGNREGA, and filing civic complaints.`
    };
  }

  if (lower.includes('kaise ho') || lower.includes('how are you')) {
    return {
      reply: isHindi
        ? `मैं बिल्कुल ठीक हूँ! आपकी सेवा के लिए तत्पर हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?`
        : `I am doing great and ready to assist you! How can Gram Sahayak help you today?`
    };
  }

  if (lower.includes('thank') || lower.includes('shukriya') || lower.includes('dhanyawad') || lower.includes('धन्यवाद')) {
    return {
      reply: isHindi
        ? `आपका स्वागत है! ग्राम पंचायत आपकी सेवा में सदैव तत्पर है। 🙏`
        : `You are most welcome! The Gram Panchayat is always here to assist you. 🙏`
    };
  }

  // 3. SCHEME DISCOVERY
  const hasSpecificService = lower.includes('kisan') || lower.includes('ration') || lower.includes('land') || lower.includes('pension') || lower.includes('ayushman') || lower.includes('awas') || lower.includes('mgnrega') || lower.includes('solar') || lower.includes('samuh') || lower.includes('scholarship') || lower.includes('pashu');
  if (!hasSpecificService && (lower.includes('scheme') || lower.includes('yojana') || lower.includes('benefit') || lower.includes('government help') || lower.includes('सरकारी योजना'))) {
    return {
      reply: isHindi
        ? `📋 <b>उपलब्ध सरकारी योजनाएं:</b> PM-किसान, PM-कुसुम सौर पंप, मनरेगा जॉब कार्ड, राशन कार्ड, वृद्धावस्था पेंशन, स्वयंसहायता समूह, PM आवास और आयुष्मान भारत। किसी योजना का नाम लिखें या नीचे सेवाएं देखें।`
        : `📋 <b>Available Government Schemes:</b> PM-Kisan, PM-KUSUM Solar Pump, MGNREGA Job Card, Ration Card, Pensions, Self-Help Groups (NRLM), PM Awas, and Ayushman Bharat. Tell me a scheme name or browse services below.`,
      actions: [{ label: isHindi ? 'सभी सेवाएं देखें' : 'Browse All Services', tab: 'tab-services' }]
    };
  }

  // 4. PM-KISAN & FARMING SCHEMES
  if (lower.includes('kisan') || lower.includes('pmkisan') || lower.includes('किसान') || lower.includes('fasal') || lower.includes('khet') || lower.includes('farm') || lower.includes('beej') || lower.includes('crop') || lower.includes('खेती')) {
    return {
      reply: isHindi
        ? `🌾 <b>PM-किसान एवं कृषि सहायता:</b>\n\n1. <b>अगली किस्त:</b> ₹2,000 की किस्त सीधे आधार से लिंक बैंक खाते में जमा होती है।\n2. <b>आवश्यकता:</b> e-KYC और भूमि सत्यापन पूर्ण होना अनिवार्य है।\n3. <b>आवेदन:</b> आप नीचे 'आवेदन करें' बटन दबाकर सीधे पंचायत में जमा कर सकते हैं।`
        : `🌾 <b>PM-Kisan & Agriculture Assistance:</b>\n\n1. <b>Installment:</b> ₹2,000 per installment is directly credited to your Aadhaar-linked bank account.\n2. <b>Requirements:</b> Complete e-KYC and land seeding status.\n3. <b>Application:</b> You can submit your application directly below!`,
      actions: [
        { label: isHindi ? 'PM-Kisan हेतु आवेदन करें' : 'Apply for PM-Kisan', tab: 'tab-services', scheme: 'PM-Kisan Samman Nidhi' }
      ]
    };
  }

  // 5. SOLAR PUMP & PM-KUSUM SCHEME
  if (lower.includes('solar') || lower.includes('kusum') || lower.includes('pump') || lower.includes('sinchai') || lower.includes('सोलर') || lower.includes('पंप') || lower.includes('सिंचाई')) {
    return {
      reply: isHindi
        ? `☀️ <b>PM-कुसुम सौर पंप योजना (Solar Irrigation Pump):</b>\n\n• <b>सब्सिडी:</b> 3HP से 7.5HP सौर सिंचाई पंप पर 60% से 90% तक की भारी सरकारी सब्सिडी।\n• <b>पात्रता:</b> किसान के नाम भूमि खतौनी और सिंचाई का साधन होना आवश्यक।\n• <b>आवेदन:</b> पंचायत सेवा केंद्र के माध्यम से ऑनलाइन पंजीकरण खुला है।`
        : `☀️ <b>PM-KUSUM Solar Irrigation Pump Scheme:</b>\n\n• <b>Subsidy:</b> 60% to 90% government subsidy on 3HP to 7.5HP solar pumps for agriculture.\n• <b>Eligibility:</b> Farmers with valid land record (Khatauni).\n• <b>Application:</b> Available through the Panchayat CSC center.`,
      actions: [
        { label: isHindi ? 'सोलर पंप हेतु आवेदन करें' : 'Apply Solar Pump', tab: 'tab-services', scheme: 'PM-KUSUM Solar Pump Scheme' }
      ]
    };
  }

  // 6. RURAL EMPLOYMENT / MGNREGA / JOB CARD
  if (lower.includes('mgnrega') || lower.includes('nrega') || lower.includes('job card') || lower.includes('jobcard') || lower.includes('rozgar') || lower.includes('मनरेगा') || lower.includes('रोजगार')) {
    return {
      reply: isHindi
        ? `👷 <b>मनरेगा (MGNREGA) एवं रोजगार गारंटी:</b>\n\n• <b>अधिकार:</b> प्रति वर्ष 100 दिनों के अकुशल रोजगार की गारंटी।\n• <b>आवश्यकता:</b> जॉब कार्ड (ग्राम पंचायत सचिव या ग्राम रोजगार सेवक द्वारा जारी)।\n• <b>मजदूरी:</b> सीधे बैंक खाते में DBT के माध्यम से हस्तांतरित।`
        : `👷 <b>MGNREGA Rural Employment Scheme:</b>\n\n• <b>Entitlement:</b> 100 days of guaranteed wage employment per financial year.\n• <b>Job Card:</b> Issued by the Gram Panchayat Secretary.\n• <b>Payment:</b> Direct Benefit Transfer (DBT) directly to your bank account.`,
      actions: [
        { label: isHindi ? 'जॉब कार्ड हेतु आवेदन करें' : 'Apply for Job Card', tab: 'tab-services', scheme: 'MGNREGA Job Card Registration' }
      ]
    };
  }

  // 7. WOMEN SELF-HELP GROUPS (SHG) & NRLM MICRO-LOANS
  if (lower.includes('samuh') || lower.includes('shg') || lower.includes('nrlm') || lower.includes('mahila') || lower.includes('bachat') || lower.includes('loan') || lower.includes('समूह') || lower.includes('ऋण')) {
    return {
      reply: isHindi
        ? `👩‍🌾 <b>महिला स्वयं सहायता समूह (NRLM - Aajeevika Mission):</b>\n\n• <b>सुविधाएं:</b> ₹1.5 लाख से ₹5 लाख तक का कम ब्याज दर (कम्यूनिटी इन्वेस्टमेंट फंड) पर आजीविका ऋण।\n• <b>गतिविधियां:</b> सिलाई, डेयरी, सिलाई केंद्र, ऑर्गेनिक उत्पाद, और लघु उद्योग।\n• <b>पंजीकरण:</b> समूह गठन हेतु पंचायत सचिव या समूह सखी से संपर्क करें।`
        : `👩‍🌾 <b>Self-Help Groups (NRLM Livelihood Mission):</b>\n\n• <b>Loans:</b> Micro-loans ranging from ₹1.5 Lakh to ₹5 Lakh for women entrepreneurs.\n• <b>Activities:</b> Tailoring, Dairy, Handicrafts, Organic Farming, and Micro-business.\n• <b>Registration:</b> Form a group via Gram Panchayat Samuh Sakhi.`,
      actions: [
        { label: isHindi ? 'समूह योजना देखें' : 'Explore SHG Scheme', tab: 'tab-services', scheme: 'Self-Help Group (NRLM) Registration' }
      ]
    };
  }

  // 8. SOIL HEALTH CARD & FERTILIZER SUBSIDY
  if (lower.includes('soil') || lower.includes('mrida') || lower.includes('khaad') || lower.includes('fertilizer') || lower.includes('dap') || lower.includes('urea') || lower.includes('mitti') || lower.includes('खाद') || lower.includes('मिट्टी')) {
    return {
      reply: isHindi
        ? `🧪 <b>मृदा स्वास्थ्य कार्ड (Soil Health Card) एवं खाद दरें:</b>\n\n• <b>मिट्टी जांच:</b> निःशुल्क पोषक तत्व जांच (N, P, K, pH स्तर) पंचायत कृषि केंद्र पर उपलब्ध।\n• <b>सरकारी खाद दरें:</b> यूरिया ₹266.50 प्रति बोरी, DAP ₹1,350 प्रति बोरी। PoS मशीन द्वारा बायोमेट्रिक खरीद अनिवार्य।`
        : `🧪 <b>Soil Health Card & Subsidized Fertilizers:</b>\n\n• <b>Soil Testing:</b> Free soil testing for NPK levels at the local Agriculture Service Center.\n• <b>Subsidized Rates:</b> Urea ₹266.50/bag, DAP ₹1,350/bag via Aadhaar PoS biometric purchase.`
    };
  }

  // 9. WEATHER & AGRICULTURAL ADVISORY
  if (lower.includes('weather') || lower.includes('baarish') || lower.includes('barish') || lower.includes('rain') || lower.includes('keeda') || lower.includes('pest') || lower.includes('मौसम') || lower.includes('बारिश') || lower.includes('कीट')) {
    return {
      reply: isHindi
        ? `🌦️ <b>मौसम एवं कृषि सलाह:</b>\n\n• <b>मौसम अनुमान:</b> अगले 3 दिनों में आंशिक बादल छाये रहने और हल्की वर्षा की संभावना।\n• <b>कीट नियंत्रण:</b> फसलों में कीट या फफूंद दिखने पर नजदीकी ब्लॉक कृषि अधिकारी या 1551 किसान कॉल सेंटर पर संपर्क करें।`
        : `🌦️ <b>Weather & Farm Advisory:</b>\n\n• <b>Forecast:</b> Partially cloudy with light rain expected over the next 3 days.\n• <b>Pest Control:</b> For crop disease queries, dial 1551 (Kisan Call Center).`
    };
  }

  // 10. STUDENT SCHOLARSHIPS & EDUCATION
  if (lower.includes('scholarship') || lower.includes('school') || lower.includes('padhai') || lower.includes('student') || lower.includes('छात्रवृत्ति') || lower.includes('शिक्षा')) {
    return {
      reply: isHindi
        ? `🎓 <b>ग्रामीण छात्रवृत्ति एवं शिक्षा सहायता:</b>\n\n• <b>योजनाएं:</b> प्री-मैट्रिक (कक्षा 9-10) एवं पोस्ट-मैट्रिक छात्रवृत्ति (SC/ST/OBC/EWS हेतु)।\n• <b>दस्तावेज़:</b> आय प्रमाण पत्र, जाति प्रमाण, आधार कार्ड, बैंक खाता, और आय सीमा (₹2.5 लाख तक)।`
        : `🎓 <b>Rural Student Scholarships:</b>\n\n• <b>Programs:</b> Pre-Matric and Post-Matric Scholarships for SC/ST/OBC/EWS students.\n• <b>Documents:</b> Income Certificate, Caste Certificate, Aadhaar, Bank Passbook.`
    };
  }

  // 11. GRAM SABHA MEETINGS & PANCHAYAT SCHEDULE
  if (lower.includes('baithak') || lower.includes('meeting') || lower.includes('gram sabha') || lower.includes('sabha') || lower.includes('ग्राम सभा') || lower.includes('बैठक')) {
    return {
      reply: isHindi
        ? `🏛️ <b>ग्राम सभा बैठक एवं निर्णय प्रक्रिया:</b>\n\n• <b>वार्षिक बैठकें:</b> 26 जनवरी, 1 मई, 15 अगस्त और 2 अक्टूबर।\n• <b>अधिकार:</b> प्रत्येक 18+ मतदाता ग्राम सभा बैठक में प्रस्ताव रख सकते हैं और विकास कार्यों की समीक्षा कर सकते हैं।`
        : `🏛️ <b>Gram Sabha Meetings & Civic Rights:</b>\n\n• <b>Schedule:</b> Mandatory meetings on 26 Jan, 1 May, 15 Aug, and 2 Oct.\n• <b>Rights:</b> All registered voters can propose village development projects.`
    };
  }

  // 12. LIVESTOCK, ANIMAL INSURANCE & VETERINARY CARE
  if (lower.includes('pashu') || lower.includes('animal') || lower.includes('cow') || lower.includes('gaaye') || lower.includes('bhains') || lower.includes('bima') || lower.includes('पशु')) {
    return {
      reply: isHindi
        ? `🐄 <b>पशुपालन एवं पशु स्वास्थ्य सहायता:</b>\n\n• <b>पशु बीमा (Pashu Bima):</b> 70% सब्सिडी पर गाय व भैंस हेतु बीमा योजना।\n• <b>टीकाकरण:</b> खुरपका-मुंहपका (FMD) निःशुल्क टीकाकरण ड्राइव जारी है।\n• <b>पशु डॉक्टर हेल्पलाइन:</b> 1962 (डोरस्टेप पशु चिकित्सा सेवा)।`
        : `🐄 <b>Livestock & Veterinary Care:</b>\n\n• <b>Cattle Insurance:</b> 70% subsidized insurance for cattle and buffaloes.\n• <b>Free Vaccination:</b> FMD vaccination drives active.\n• <b>Veterinary Helpline:</b> Dial 1962 for doorstep cattle treatment.`
    };
  }

  // 13. RATION CARD
  if (lower.includes('ration') || lower.includes('राशन') || lower.includes('quota') || lower.includes('dealer') || lower.includes('food card') || lower.includes('food grains')) {
    return {
      reply: isHindi
        ? `🍚 <b>राशन कार्ड सेवा गाइड:</b>\n\n• <b>पात्रता:</b> बीपीएल / पात्र गृहस्थी राशन कार्ड हेतु आय प्रमाण पत्र आवश्यक है।\n• <b>दस्तावेज़:</b> परिवार के सभी सदस्यों के आधार कार्ड, आय प्रमाण पत्र, निवास प्रमाण।`
        : `🍚 <b>Ration Card Services Guide:</b>\n\n• <b>Documents Needed:</b> Aadhaar card for all family members, Income Certificate, and Address proof.`,
      actions: [
        { label: isHindi ? 'राशन कार्ड सेवा लागू करें' : 'Apply Ration Card', tab: 'tab-services', scheme: 'Ration Card Member Addition' }
      ]
    };
  }

  // 14. LAND RECORDS / BHULEKH
  if (lower.includes('bhulekh') || lower.includes('khatauni') || lower.includes('khasra') || lower.includes('zameen') || lower.includes('land') || lower.includes('plot') || lower.includes('भूलेख') || lower.includes('खतौनी')) {
    return {
      reply: isHindi
        ? `📜 <b>भूलेख (खतौनी/खसरा) जानकारी:</b>\n\n• अपनी जमीन की खतौनी एवं खसरा संख्या आप तुरंत देख सकते हैं।\n• नामांतरण (दाखिल-खारिज) के लिए लेखपाल सत्यापन रिपोर्ट तैयार करते हैं।`
        : `📜 <b>Land Records (Bhulekh / Khatauni):</b>\n\n• Access digital land records and verify plot ownership status.\n• Ownership transfer is reviewed directly by the Village Lekhpal.`,
      actions: [
        { label: isHindi ? 'भूलेख ऑनलाइन देखें' : 'View Land Records', tab: 'tab-services', scheme: 'Land Records (Bhulekh)' }
      ]
    };
  }

  // 15. AYUSHMAN BHARAT & HEALTHCARE
  if (lower.includes('ayushman') || lower.includes('health') || lower.includes('ilaj') || lower.includes('hospital') || lower.includes('आयुष्मान') || lower.includes('इलाज')) {
    return {
      reply: isHindi
        ? `🏥 <b>आयुष्मान भारत कार्ड:</b>\n\n• प्रति परिवार प्रति वर्ष ₹5 लाख तक का मुफ्त इलाज।\n• आधार कार्ड एवं राशन कार्ड के साथ निकटतम पंचायत जन सेवा केंद्र (CSC) जाएँ।`
        : `🏥 <b>Ayushman Bharat Scheme:</b>\n\n• Free secondary hospital care up to ₹5 Lakh per family annually.\n• Bring Aadhaar and Ration Card to the Panchayat CSC Center to generate your card.`
    };
  }

  // 16. CERTIFICATES AND DOCUMENTS
  if (lower.includes('certificate') || lower.includes(' प्रमाण') || lower.includes('birth proof') || lower.includes('income proof') || lower.includes('domicile') || lower.includes('residence proof') || lower.includes('जाति प्रमाण')) {
    return {
      reply: isHindi
        ? `📄 <b>प्रमाण पत्र सेवाएं:</b> आय, निवास, जाति और जन्म प्रमाण पत्र के लिए पहचान पत्र, पता प्रमाण और संबंधित दस्तावेज़ साथ रखें। आवेदन पंचायत सेवा केंद्र पर जमा किया जा सकता है।`
        : `📄 <b>Certificate Services:</b> For income, residence, caste, or birth certificates, keep your identity proof, address proof, and supporting documents ready. Applications can be submitted at the Panchayat service center.`,
      actions: [{ label: isHindi ? 'सेवाएं देखें' : 'Browse Services', tab: 'tab-services' }]
    };
  }

  // 17. PENSIONS
  if (lower.includes('pension') || lower.includes('pencion') || lower.includes('पेंशन') || lower.includes('vriddha') || lower.includes('vidhwa') || lower.includes('divyang')) {
    return {
      reply: isHindi
        ? `👵 <b>वृद्धावस्था एवं विधवा पेंशन योजना:</b>\n\n• <b>पात्रता:</b> 60 वर्ष से अधिक आयु के नागरिक एवं विधवा महिलाएं।\n• <b>दस्तावेज़:</b> आयु प्रमाण, बैंक पासबुक, आय प्रमाण, आधार कार्ड।`
        : `👵 <b>Pension Schemes:</b>\n\n• <b>Eligibility:</b> Senior Citizens (60+ yrs) and Widows.\n• <b>Documents:</b> Age proof, Bank Passbook, Income Certificate, Aadhaar.`,
      actions: [
        { label: isHindi ? 'पेंशन के लिए आवेदन करें' : 'Apply for Pension', tab: 'tab-services', scheme: 'Old Age Pension Scheme' }
      ]
    };
  }

  // 18. HOUSING SCHEME / PM AWAS
  if (lower.includes('awas') || lower.includes('ghar') || lower.includes('house') || lower.includes('pmay') || lower.includes('आवास')) {
    return {
      reply: isHindi
        ? `🏠 <b>प्रधानमंत्री आवास योजना (ग्रामीण):</b>\n\n• पक्के मकान निर्माण हेतु ₹1,20,000 की सहायता 3 किस्तों में।\n• चयन ग्राम सभा की सर्वे सूची के आधार पर होता है।`
        : `🏠 <b>PM Awas Housing Scheme:</b>\n\n• ₹1,20,000 assistance in 3 installments for constructing a pucca house.`
    };
  }

  // 19. CIVIC COMPLAINTS & PROBLEMS
  if (lower.includes('water') || lower.includes('paani') || lower.includes('pani') || lower.includes('electricity') || lower.includes('nal') || lower.includes('light') || lower.includes('streetlight') || lower.includes('bijli') || lower.includes('road') || lower.includes('sadak') || lower.includes('garbage') || lower.includes('kachra') || lower.includes('drain') || lower.includes('sewage') || lower.includes('pothole') || lower.includes('complaint') || lower.includes('पानी') || lower.includes('बिजली') || lower.includes('कचरा')) {
    return {
      reply: isHindi
        ? `🚨 <b>समस्या समाधान:</b>\n\nयदि आपके क्षेत्र में पानी, बिजली, सड़क या सफाई की समस्या है, तो आप तुरंत फोटो एवं जीपीएस लोकेशन के साथ शिकायत दर्ज कर सकते हैं!`
        : `🚨 <b>Filing Civic Complaints:</b>\n\nFor issues with water, broken lights, or roads, submit a complaint with photo and GPS location!`,
      actions: [
        { label: isHindi ? 'अभी शिकायत दर्ज करें' : 'File Complaint Now', tab: 'tab-report' }
      ]
    };
  }

  // 20. HELPLINES & OFFICERS
  if (lower.includes('pradhan') || lower.includes('sarpanch') || lower.includes('secretary') || lower.includes('sachiv') || lower.includes('lekhpal') || lower.includes('helpline') || lower.includes('number')) {
    return {
      reply: isHindi
        ? `📞 <b>ग्राम पंचायत महत्वपूर्ण संपर्क:</b>\n\n• ग्राम प्रधान कार्यालय: ग्राम पंचायत भवन\n• आपातकालीन हेल्पलाइन: 112 (पुलिस), 108 (एम्बुलेंस), 1090 (महिला हेल्पलाइन), 1551 (किसान कॉल सेंटर), 1962 (पशु चिकित्सा)`
        : `📞 <b>Village Officers & Helplines:</b>\n\n• Gram Panchayat Office: Gram Panchayat Bhavan\n• Emergency Lines: 112 (Police), 108 (Ambulance), 1090 (Women Helpline), 1551 (Kisan Call Center), 1962 (Veterinary)`
    };
  }

  // 21. FALLBACK
  return {
    reply: isHindi
      ? `नमस्ते! आपने पूछा: "${input}".\n\nमैं ग्राम सहायक हूँ। मैं आपको ग्राम पंचायत सेवाओं (PM-किसान, सौर पंप, मनरेगा, स्वयं सहायता समूह, राशन कार्ड, भूलेख, पेंशन) एवं शिकायत दर्ज करने में मदद कर सकता हूँ।`
      : `Namaste! Regarding "${input}":\n\nI am Gram Sahayak, your rural assistant. I can guide you through local schemes (PM-Kisan, Solar Pump, MGNREGA, SHG Groups, Ration Card, Bhulekh, Pensions) or help you file complaints.`,
    actions: [
      { label: isHindi ? 'सेवाएं देखें' : 'Browse Services', tab: 'tab-services' },
      { label: isHindi ? 'शिकायत करें' : 'Report Issue', tab: 'tab-report' }
    ]
  };
}

module.exports = { processUserQuery };