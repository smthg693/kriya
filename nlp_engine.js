// Gram Sahayak Advanced Multi-Lingual NLP & Dialog Engine
// Features: Typo Tolerance, Intent Classification, Real-Time Database Queries, Clean Formatting (No raw stars), & Interactive Action Buttons.

async function processUserQuery(text, citizenId, dbAsync, preferredLang = 'en') {
  const input = (text || '').trim();
  const lower = input.toLowerCase()
    .replace(/[!?.,;:()[\]{}]/g, ' ')
    .replace(/\bpm\s*-?\s*kisan\b/g, 'pmkisan')
    .replace(/\b(pencion|pention)\b/g, 'pension')
    .replace(/\b(raashan|rasan)\b/g, 'ration')
    .replace(/\b(bulek|bhulekhh)\b/g, 'bhulekh')
    .replace(/\b(bijly|bijlii)\b/g, 'bijli')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Language detection: Hindi script, Hinglish markers, or English
  const hasHindiScript = /[अ-ह]/.test(input);
  const hinglishMarkers = ['kya', 'hai', 'mera', 'meri', 'kaise', 'kab', 'kahan', 'namaste', 'batao', 'chahiye'];
  const isHinglish = hinglishMarkers.some(word => lower.includes(word));
  const isHindi = preferredLang === 'hi' || hasHindiScript || isHinglish;

  // 1. LIVE DATA LOOKUP (Real-Time Database Query)
  const isStatusRequest = lower.includes('status') || lower.includes('track') || lower.includes('my app') || lower.includes('my complaint') || lower.includes('mera status') || lower.includes('meri status') || lower.includes('where is my application') || lower.includes('how far is my') || lower.includes('progress of my');
  if (isStatusRequest) {
    try {
      const queryCitizenId = citizenId || 'CIT-001';
      const reports = await dbAsync.findMany('reports', { citizen_id: queryCitizenId }, { sort: { id: -1 }, limit: 2 });
      const apps = await dbAsync.findMany('applications', { citizen_id: queryCitizenId }, { sort: { id: -1 }, limit: 2 });

      if ((!reports || reports.length === 0) && (!apps || apps.length === 0)) {
        return {
          reply: isHindi
            ? `नमस्ते! वर्तमान में आपके खाते (${citizenId || 'CIT-001'}) के लिए कोई सक्रिय शिकायत या आवेदन दर्ज नहीं है। आप नीचे दिए गए बटन से नया आवेदन कर सकते हैं:`
            : `Namaste! Currently there are no active complaints or applications registered for your account (${citizenId || 'CIT-001'}). You can submit a request below:`,
          actions: [
            { label: isHindi ? 'समस्या रिपोर्ट करें' : 'Report a Problem', tab: 'tab-report' },
            { label: isHindi ? 'योजनाएं देखें' : 'Browse Schemes', tab: 'tab-services' }
          ]
        };
      }

      let summary = isHindi ? `📊 <b>आपकी वास्तविक समय स्थिति (${citizenId || 'CIT-001'}):</b>\n\n` : `📊 <b>Your Real-Time Live Status (${citizenId || 'CIT-001'}):</b>\n\n`;
      
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
        ? `नमस्ते! 🙏 मैं आपका ग्राम सहायक मित्र हूँ। मैं कल्याणपुर पंचायत में भूलेख, राशन कार्ड, पेंशन, किसान योजनाओं और गांव की समस्याओं को हल करने में आपकी मदद कर सकता हूँ।`
        : `Namaste! 🙏 I am Gram Sahayak, your digital assistant for Kalyanpur village. I can help you with land records (Bhulekh), ration cards, pensions, PM-Kisan schemes, and filing civic complaints.`
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
        ? `आपका स्वागत है! ग्राम पंचायत कल्याणपुर आपकी सेवा में सदैव तत्पर है। 🙏`
        : `You are most welcome! Gram Panchayat Kalyanpur is always here to assist you. 🙏`
    };
  }

  // 3. SCHEME DISCOVERY
  const hasSpecificService = lower.includes('kisan') || lower.includes('ration') || lower.includes('land') || lower.includes('pension') || lower.includes('ayushman') || lower.includes('awas');
  if (!hasSpecificService && (lower.includes('scheme') || lower.includes('yojana') || lower.includes('benefit') || lower.includes('government help') || lower.includes('सरकारी योजना'))) {
    return {
      reply: isHindi
        ? `📋 <b>उपलब्ध सरकारी योजनाएं:</b> PM-किसान, राशन कार्ड, वृद्धावस्था पेंशन, PM आवास और आयुष्मान भारत। किसी योजना का नाम लिखें या नीचे सेवाएं देखें।`
        : `📋 <b>Available Government Schemes:</b> PM-Kisan, Ration Card, Old Age Pension, PM Awas, and Ayushman Bharat. Tell me a scheme name or browse services below.`,
      actions: [{ label: isHindi ? 'सभी सेवाएं देखें' : 'Browse All Services', tab: 'tab-services' }]
    };
  }

  // 4. PM-KISAN & FARMING SCHEMES
  if (lower.includes('kisan') || lower.includes('pmkisan') || lower.includes('किसान') || lower.includes('fasal') || lower.includes('khet') || lower.includes('farm') || lower.includes('fertilizer') || lower.includes('khaad') || lower.includes('beej') || lower.includes('crop') || lower.includes('खेती')) {
    return {
      reply: isHindi
        ? `🌾 <b>PM-किसान एवं कृषि सहायता:</b>\n\n1. <b>अगली किस्त:</b> ₹2,000 की किस्त सीधे आधार से लिंक बैंक खाते में जमा होती है।\n2. <b>आवश्यकता:</b> e-KYC और भूमि सत्यापन पूर्ण होना अनिवार्य है।\n3. <b>आवेदन:</b> आप नीचे 'आवेदन करें' बटन दबाकर सीधे पंचायत में जमा कर सकते हैं।`
        : `🌾 <b>PM-Kisan & Agriculture Assistance:</b>\n\n1. <b>Installment:</b> ₹2,000 per installment is directly credited to your Aadhaar-linked bank account.\n2. <b>Requirements:</b> Complete e-KYC and land seeding status.\n3. <b>Application:</b> You can submit your application directly below!`,
      actions: [
        { label: isHindi ? 'PM-Kisan हेतु आवेदन करें' : 'Apply for PM-Kisan', tab: 'tab-services', scheme: 'PM-Kisan Samman Nidhi' }
      ]
    };
  }

  // 5. RATION CARD
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

  // 6. LAND RECORDS / BHULEKH
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

  // 6. AYUSHMAN BHARAT & HEALTHCARE (Supports typos: ayushman, health, ilaj, hospital)
  if (lower.includes('ayushman') || lower.includes('health') || lower.includes('ilaj') || lower.includes('hospital') || lower.includes('आयुष्मान') || lower.includes('इलाज')) {
    return {
      reply: isHindi
        ? `🏥 <b>आयुष्मान भारत कार्ड:</b>\n\n• प्रति परिवार प्रति वर्ष ₹5 लाख तक का मुफ्त इलाज।\n• आधार कार्ड एवं राशन कार्ड के साथ जन सेवा केंद्र (CSC) कल्याणपुर जाएँ।`
        : `🏥 <b>Ayushman Bharat Scheme:</b>\n\n• Free secondary hospital care up to ₹5 Lakh per family annually.\n• Bring Aadhaar and Ration Card to CSC Kalyanpur to generate your card.`
    };
  }

  // 7. CERTIFICATES AND DOCUMENTS
  if (lower.includes('certificate') || lower.includes(' प्रमाण') || lower.includes('birth proof') || lower.includes('income proof') || lower.includes('domicile') || lower.includes('residence proof') || lower.includes('जाति प्रमाण')) {
    return {
      reply: isHindi
        ? `📄 <b>प्रमाण पत्र सेवाएं:</b> आय, निवास, जाति और जन्म प्रमाण पत्र के लिए पहचान पत्र, पता प्रमाण और संबंधित दस्तावेज़ साथ रखें। आवेदन पंचायत सेवा केंद्र पर जमा किया जा सकता है।`
        : `📄 <b>Certificate Services:</b> For income, residence, caste, or birth certificates, keep your identity proof, address proof, and supporting documents ready. Applications can be submitted at the Panchayat service center.`,
      actions: [{ label: isHindi ? 'सेवाएं देखें' : 'Browse Services', tab: 'tab-services' }]
    };
  }

  // 8. PENSIONS
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

  // 9. HOUSING SCHEME / PM AWAS
  if (lower.includes('awas') || lower.includes('ghar') || lower.includes('house') || lower.includes('pmay') || lower.includes('आवास')) {
    return {
      reply: isHindi
        ? `🏠 <b>प्रधानमंत्री आवास योजना (ग्रामीण):</b>\n\n• पक्के मकान निर्माण हेतु ₹1,20,000 की सहायता 3 किस्तों में।\n• चयन ग्राम सभा की सर्वे सूची के आधार पर होता है।`
        : `🏠 <b>PM Awas Housing Scheme:</b>\n\n• ₹1,20,000 assistance in 3 installments for constructing a pucca house.`
    };
  }

  // 10. CIVIC COMPLAINTS & PROBLEMS
  if (lower.includes('water') || lower.includes('paani') || lower.includes('pani') || lower.includes('nal') || lower.includes('light') || lower.includes('streetlight') || lower.includes('bijli') || lower.includes('road') || lower.includes('sadak') || lower.includes('garbage') || lower.includes('kachra') || lower.includes('drain') || lower.includes('sewage') || lower.includes('pothole') || lower.includes('पानी') || lower.includes('बिजली') || lower.includes('कचरा')) {
    return {
      reply: isHindi
        ? `🚨 <b>समस्या समाधान:</b>\n\nयदि आपके क्षेत्र में पानी, बिजली, सड़क या सफाई की समस्या है, तो आप तुरंत फोटो एवं जीपीएस लोकेशन के साथ शिकायत दर्ज कर सकते हैं!`
        : `🚨 <b>Filing Civic Complaints:</b>\n\nFor issues with water, broken lights, or roads, submit a complaint with photo and GPS location!`,
      actions: [
        { label: isHindi ? 'अभी शिकायत दर्ज करें' : 'File Complaint Now', tab: 'tab-report' }
      ]
    };
  }

  // 10. HELPLINES & OFFICERS (Supports typos: pradhan, sarpanch, secretary, sachiv, lekhpal)
  if (lower.includes('pradhan') || lower.includes('sarpanch') || lower.includes('secretary') || lower.includes('sachiv') || lower.includes('lekhpal') || lower.includes('helpline') || lower.includes('number')) {
    return {
      reply: isHindi
        ? `📞 <b>ग्राम पंचायत महत्वपूर्ण संपर्क:</b>\n\n• ग्राम प्रधान कार्यालय: कल्याणपुर पंचायत भवन\n• आपातकालीन हेल्पलाइन: 112 (पुलिस), 108 (एम्बुलेंस), 1090 (महिला हेल्पलाइन), 1551 (किसान कॉल सेंटर)`
        : `📞 <b>Village Officers & Helplines:</b>\n\n• Gram Panchayat Office: Kalyanpur Panchayat Bhavan\n• Emergency Lines: 112 (Police), 108 (Ambulance), 1090 (Women Helpline), 1551 (Kisan Call Center)`
    };
  }

  // 11. FALLBACK
  return {
    reply: isHindi
      ? `नमस्ते! आपने पूछा: "${input}".\n\nमैं ग्राम सहायक हूँ। मैं आपको ग्राम पंचायत सेवाओं (PM-किसान, राशन कार्ड, भूलेख, पेंशन) एवं शिकायत दर्ज करने में मदद कर सकता हूँ।`
      : `Namaste! Regarding "${input}":\n\nI am Gram Sahayak, your rural assistant. I can guide you through local schemes (PM-Kisan, Ration Card, Bhulekh, Pensions) or help you file complaints.`,
    actions: [
      { label: isHindi ? 'सेवाएं देखें' : 'Browse Services', tab: 'tab-services' },
      { label: isHindi ? 'शिकायत करें' : 'Report Issue', tab: 'tab-report' }
    ]
  };
}

module.exports = { processUserQuery };