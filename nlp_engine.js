// Gram Sahayak Production NLU Engine & Dialogue Manager
// Architecture: Python NLU Service (FastAPI) + Multilingual Embeddings + Scikit-Learn Classifier + Resilient Fallback + Confidence Gater + Dialogue Memory + Conversational Small Talk LLM Layer

const { parseNLU } = require('./nlu_client');
const { getSession, updateSession, resolveContextCarryOver } = require('./dialogue_manager');
const { logNLUEvent } = require('./nlu_logger');

const DICTIONARY = {
  GREETING: {
    hi: `नमस्ते! मैं आपका ग्राम सहायक डिजिटल मित्र हूँ। मैं पंचायत में भूलेख, राशन कार्ड, पेंशन, किसान योजनाओं (PM-Kisan), सौर पंप, मनरेगा और गांव की समस्याओं को हल करने में आपकी मदद कर सकता हूँ।`,
    mr: `नमस्कार! मी ग्राम सहायक आहे, तुमचा ग्राम पंचायतीचा डिजिटल साहाय्यक. मी तुम्हाला भूलेख, रेशन कार्ड, पेन्शन, शेतकरी योजना (PM-Kisan), सोलर पंप, मनरेगा आणि गावातील तक्रारी सोडवण्यास मदत करू शकतो.`,
    en: `Namaste! I am Gram Sahayak, your digital assistant for the Gram Panchayat. I can help you with land records (Bhulekh), ration cards, pensions, PM-Kisan, solar pumps, MGNREGA, and filing civic complaints.`
  },
  WHO_ARE_YOU: {
    hi: `मैं <b>ग्राम सहायक (Gram Sahayak)</b> हूँ - आपकी ग्राम पंचायत डिजिटल सेवाओं के लिए समर्पित एआई सहायक। मेरा उद्देश्य ग्रामीणों को सरकारी योजनाओं, भूलेख, पेंशन, राशन कार्ड की जानकारी देना और नागरिक शिकायतें हल करने में सहायता करना है!`,
    mr: `मी <b>ग्राम सहायक (Gram Sahayak)</b> आहे - तुमच्या ग्राम पंचायत डिजिटल सेवांसाठी समर्पित AI साहाय्यक. माझे ध्येय नागरिकांना शासकीय योजना, 7/12 भूलेख, पेन्शन, रेशन कार्डची माहिती देणे आणि नागरी तक्रारी सोडवण्यात मदत करणे हे आहे!`,
    en: `I am <b>Gram Sahayak</b> - an intelligent AI assistant built specifically for Gram Panchayat digital governance. My goal is to simplify village administration, explain government schemes (PM-Kisan, Solar Pump, MGNREGA), assist with land records, and help citizens file civic complaints!`,
    actions: [
      { labelHi: 'सेवाएं देखें', labelMr: 'सेवा पहा', labelEn: 'Browse Services', tab: 'tab-services' }
    ]
  },
  WHAT_CAN_YOU_DO: {
    hi: `मैं आपकी निम्नलिखित कार्यों में सहायता कर सकता हूँ:\n\n1. 🌾 <b>किसान योजनाएं:</b> PM-किसान सम्मान निधि, PM-कुसुम सौर पंप, मनरेगा जॉब कार्ड, मृदा जांच।\n2. 📄 <b>भूलेख व प्रमाण पत्र:</b> खतौनी (7/12), आय/जाति/निवास प्रमाण पत्र।\n3. 🏥 <b>कल्याणकारी योजनाएं:</b> वृद्धावस्था पेंशन, आयुष्मान भारत कार्ड, राशन कार्ड, महिला स्वयं सहायता समूह।\n4. 🚨 <b>नागरिक शिकायतें:</b> पानी, बिजली, सड़क, सफाई की शिकायत सीधे पंचायत सचिव को दर्ज करें!`,
    mr: `मी तुम्हाला खालील गोष्टींमध्ये मदत करू शकतो:\n\n1. 🌾 <b>शेतकरी योजना:</b> PM-किसान हप्ता, सोलर पंप अनुदान, मनरेगा जॉब कार्ड, माती परीक्षण.\n2. 📄 <b>7/12 व दाखले:</b> भूलेख 7/12 उतारा, उत्पन्न/जात दाखला.\n3. 🏥 <b>कल्याणकारी योजना:</b> पेन्शन, आयुष्यमान भारत, रेशन कार्ड, महिला बचत गट.\n4. 🚨 <b>नागरी तक्रारी:</b> पाणी, वीज, रस्त्यांच्या तक्रारी थेट ग्रामपंचायतीकडे नोंदवा!`,
    en: `Here is how I can assist you:\n\n1. 🌾 <b>Farmer Schemes:</b> PM-Kisan, PM-KUSUM Solar Pumps, MGNREGA Job Cards, Soil Health.\n2. 📄 <b>Land Records & Certificates:</b> Bhulekh (Khatauni / 7-12 Extracts), Income/Caste Certificates.\n3. 🏥 <b>Welfare & Pensions:</b> Senior Citizen Pensions, Ayushman Bharat, Ration Cards, Self-Help Groups.\n4. 🚨 <b>Civic Complaints:</b> Report broken streetlights, water supply issues, or road damage directly to Panchayat officers!`,
    actions: [
      { labelHi: 'सेवाएं देखें', labelMr: 'सर्व सेवा पहा', labelEn: 'Browse Services', tab: 'tab-services' },
      { labelHi: 'शिकायत दर्ज करें', labelMr: 'तक्रार नोंदवा', labelEn: 'Report Issue', tab: 'tab-report' }
    ]
  },
  COMPLIMENT: {
    hi: `बहुत-बहुत धन्यवाद! 😊 मैं सदैव हमारे ग्राम पंचायत के नागरिकों की सेवा के लिए उपलब्ध हूँ। जब भी सहायता चाहिए, निसंकोच बताएं!`,
    mr: `मनापासून धन्यवाद! 😊 मी सदैव आपल्या ग्रामपंचायतीच्या नागरिकांच्या सेवेसाठी तत्पर आहे. काहीही मदत लागल्यास नक्की सांगा!`,
    en: `Thank you so much! 😊 I am always here to serve our Gram Panchayat citizens. Let me know whenever you need assistance!`
  },
  FAREWELL: {
    hi: `अलविदा और आपका दिन शुभ हो! ग्राम पंचायत सेवाओं के लिए जब भी आवश्यकता हो, ग्राम सहायक से संपर्क करें।`,
    mr: `पुन्हा भेटू! तुमचा आजचा दिवस आनंददायी जावो. ग्रामपंचायत सेवांसाठी कधीही ग्राम सहायकशी संवाद साधा.`,
    en: `Goodbye and have a wonderful day ahead! Feel free to talk to Gram Sahayak anytime you need help with village services.`
  },
  SARPANCH_INFO: {
    hi: `🏛️ <b>ग्राम पंचायत कार्यालय जानकारी:</b>\n\n• <b>स्थान:</b> मुख्य चौपाल, ग्राम पंचायत भवन\n• <b>समय:</b> सोमवार से शनिवार (प्रातः 10:00 से सायं 5:00)\n• <b>अधिकारी:</b> ग्राम प्रधान/सरपंच एवं ग्राम विकास अधिकारी (सचिव)\n• <b>सेवाएं:</b> आवेदन सत्यापन, समस्या समाधान, योजना स्वीकृति।`,
    mr: `🏛️ <b>ग्रामपंचायत कार्यालय माहिती:</b>\n\n• <b>ठिकाण:</b> ग्रामपंचायत भवन, मुख्य चौक\n• <b>वेळ:</b> सोमवार ते शनिवार (सकाळी १०:०० ते संध्याकाळी ५:००)\n• <b>अधिकारी:</b> सरपंच आणि ग्रामसेवक (सचिव)\n• <b>सेवा:</b> दाखले पडताळणी, तक्रार निवारण व योजना मंजुरी.`,
    en: `🏛️ <b>Gram Panchayat Office Info:</b>\n\n• <b>Location:</b> Village Gram Panchayat Bhavan (Main Square)\n• <b>Office Hours:</b> Mon - Sat (10:00 AM - 5:00 PM)\n• <b>Officers:</b> Gram Pradhan / Sarpanch & Panchayat Secretary (VDO)\n• <b>Services:</b> Citizen verification, complaint resolution, scheme approvals.`
  },
  HOW_TO_APPLY: {
    hi: `📝 <b>आवेदन करने की सरल प्रक्रिया:</b>\n\n1. नीचे **सेवाएं** (Services) टैब पर क्लिक करें।\n2. अपनी इच्छित योजना (जैसे PM-किसान, सोलर पंप, पेंशन) चुनें।\n3. विवरण भरकर **आवेदन जमा करें** पर क्लिक करें। आप प्रोफाइल में अपनी प्रगति देख सकते हैं!`,
    mr: `📝 <b>अर्ज करण्याची सोपी पद्धत:</b>\n\n1. खालील **सेवा** (Services) टॅबवर क्लिक करा.\n2. तुमची योजना (PM-किसान, सोलर पंप, पेन्शन) निवडा.\n3. माहिती भरून **अर्ज सादर करा** वर क्लिक करा. तुम्ही प्रोफाईलमध्ये स्थिती पाहू शकता!`,
    en: `📝 <b>How to Apply for Services:</b>\n\n1. Click on the **Services** tab below.\n2. Select your desired scheme (e.g. PM-Kisan, Solar Pump, Pension).\n3. Fill in your details and click **Submit Direct Application**. You can track progress in your Profile!`,
    actions: [
      { labelHi: 'सेवाएं देखें', labelMr: 'सेवा पहा', labelEn: 'Go to Services', tab: 'tab-services' }
    ]
  },
  HOW_ARE_YOU: {
    hi: `मैं आपकी सेवा के लिए तत्पर हूँ। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
    mr: `मी तुमच्या सेवेसाठी तत्पर आहे. आज मी तुम्हाला कशी मदत करू शकतो?`,
    en: `I am ready to assist you! How can Gram Sahayak help you today?`
  },
  THANKS: {
    hi: `आपका स्वागत है! ग्राम पंचायत आपकी सेवा में सदैव तत्पर है।`,
    mr: `आपले स्वागत आहे! ग्राम पंचायत सदैव आपल्या सेवेत तत्पर आहे.`,
    en: `You are most welcome! The Gram Panchayat is always here to assist you.`
  },
  SCHEMES_GENERAL: {
    hi: `<b>उपलब्ध सरकारी योजनाएं:</b> PM-किसान, PM-कुसुम सौर पंप, मनरेगा जॉब कार्ड, राशन कार्ड, वृद्धावस्था पेंशन, स्वयंसहायता समूह, PM आवास और आयुष्मान भारत। किसी योजना का नाम लिखें या नीचे सेवाएं देखें।`,
    mr: `<b>उपलब्ध शासकीय योजना:</b> PM-किसान, PM-कुसुम सोलर पंप, मनरेगा जॉब कार्ड, रेशन कार्ड, पेन्शन योजना, महिला बचत गट, PM आवास आणि आयुष्यमान भारत.`,
    en: `<b>Available Government Schemes:</b> PM-Kisan, PM-KUSUM Solar Pump, MGNREGA Job Card, Ration Card, Pensions, Self-Help Groups (NRLM), PM Awas, and Ayushman Bharat. Tell me a scheme name or browse services below.`,
    actions: [
      { labelHi: 'सभी सेवाएं देखें', labelMr: 'सर्व सेवा पहा', labelEn: 'Browse All Services', tab: 'tab-services' }
    ]
  },
  PMKISAN: {
    hi: `<b>PM-किसान एवं कृषि सहायता:</b>\n\n1. <b>किस्त विवरण:</b> ₹2,000 की किस्त सीधे आधार से लिंक बैंक खाते में जमा होती है।\n2. <b>आवश्यकता:</b> e-KYC और भूमि सत्यापन पूर्ण होना अनिवार्य है।\n3. <b>आवेदन:</b> आप नीचे 'आवेदन करें' बटन दबाकर सीधे पंचायत में जमा कर सकते हैं।`,
    mr: `<b>PM-किसान योजना:</b>\n\n1. <b>हप्ता:</b> ₹2,000 चा हप्ता थेट आधार-लिंक बँक खात्यात जमा होतो.\n2. <b>आवश्यकता:</b> e-KYC आणि जमीन पडताळणी पूर्ण असणे आवश्यक आहे.\n3. <b>अर्ज:</b> खालील बटणावर क्लिक करून थेट अर्ज सादर करू शकता.`,
    en: `<b>PM-Kisan & Agriculture Assistance:</b>\n\n1. <b>Installment:</b> ₹2,000 per installment is directly credited to your Aadhaar-linked bank account.\n2. <b>Requirements:</b> Complete e-KYC and land seeding status.\n3. <b>Application:</b> You can submit your application directly below!`,
    actions: [
      { labelHi: 'PM-Kisan हेतु आवेदन करें', labelMr: 'PM-Kisan साठी अर्ज करा', labelEn: 'Apply for PM-Kisan', tab: 'tab-services', scheme: 'PM-Kisan Samman Nidhi' }
    ]
  },
  SOLAR: {
    hi: `<b>PM-कुसुम सौर पंप योजना (Solar Irrigation Pump):</b>\n\n• <b>सब्सिडी:</b> 3HP से 7.5HP सौर सिंचाई पंप पर 60% से 90% तक की सरकारी सब्सिडी।\n• <b>पात्रता:</b> किसान के नाम भूमि खतौनी और सिंचाई का साधन होना आवश्यक।\n• <b>आवेदन:</b> पंचायत सेवा केंद्र के माध्यम से ऑनलाइन पंजीकरण खुला है।`,
    mr: `<b>PM-कुसुम सोलर पंप योजना:</b>\n\n• <b>अनुदान:</b> 3HP ते 7.5HP सोलर पंपावर 60% ते 90% पर्यंत शासकीय अनुदान.\n• <b>पात्रता:</b> शेतकऱ्याच्या नावावर जमीन (7/12) आवश्यक.\n• <b>अर्ज:</b> पंचायत सेवा केंद्राद्वारे नोंदणी सुरू आहे.`,
    en: `<b>PM-KUSUM Solar Irrigation Pump Scheme:</b>\n\n• <b>Subsidy:</b> 60% to 90% government subsidy on 3HP to 7.5HP solar pumps for agriculture.\n• <b>Eligibility:</b> Farmers with valid land record (Khatauni).\n• <b>Application:</b> Available through the Panchayat CSC center.`,
    actions: [
      { labelHi: 'सोलर पंप हेतु आवेदन करें', labelMr: 'सोलर पंपासाठी अर्ज करा', labelEn: 'Apply Solar Pump', tab: 'tab-services', scheme: 'PM-KUSUM Solar Pump Scheme' }
    ]
  },
  MGNREGA: {
    hi: `<b>मनरेगा (MGNREGA) एवं रोजगार गारंटी:</b>\n\n• <b>अधिकार:</b> प्रति वर्ष 100 दिनों के अकुशल रोजगार की गारंटी।\n• <b>आवश्यकता:</b> जॉब कार्ड (ग्राम पंचायत सचिव या ग्राम रोजगार सेवक द्वारा जारी)।\n• <b>मजदूरी:</b> सीधे बैंक खाते में DBT के माध्यम से हस्तांतरित।`,
    mr: `<b>मनरेगा (MGNREGA) रोजगार हमी योजना:</b>\n\n• <b>हक्क:</b> दरवर्षी 100 दिवसांच्या अकुशल रोजगाराची हमी.\n• <b>जॉब कार्ड:</b> ग्रामपंचायत सचिवाद्वारे दिले जाते.\n• <b>वेतन:</b> थेट बँक खात्यात जमा.`,
    en: `<b>MGNREGA Rural Employment Scheme:</b>\n\n• <b>Entitlement:</b> 100 days of guaranteed wage employment per financial year.\n• <b>Job Card:</b> Issued by the Gram Panchayat Secretary.\n• <b>Payment:</b> Direct Benefit Transfer (DBT) directly to your bank account.`,
    actions: [
      { labelHi: 'जॉब कार्ड हेतु आवेदन करें', labelMr: 'जॉब कार्डसाठी अर्ज करा', labelEn: 'Apply for Job Card', tab: 'tab-services', scheme: 'MGNREGA Job Card Registration' }
    ]
  },
  SHG: {
    hi: `<b>महिला स्वयं सहायता समूह (NRLM - Aajeevika Mission):</b>\n\n• <b>सुविधाएं:</b> ₹1.5 लाख से ₹5 लाख तक का कम ब्याज दर पर आजीविका ऋण।\n• <b>गतिविधियां:</b> सिलाई, डेयरी, सिलाई केंद्र, ऑर्गेनिक उत्पाद, और लघु उद्योग।\n• <b>पंजीकरण:</b> समूह गठन हेतु पंचायत सचिव या समूह सखी से संपर्क करें।`,
    mr: `<b>महिला स्वयं सहाय्यता गट (बचत गट - NRLM):</b>\n\n• <b>कर्ज:</b> महिला उद्योजकांसाठी कमी व्याजदरात उपजीविका कर्ज.\n• <b>नोंदणी:</b> बचत गट स्थापनेसाठी ग्रामपंचायत किंवा समूह सखीशी संपर्क साधा.`,
    en: `<b>Self-Help Groups (NRLM Livelihood Mission):</b>\n\n• <b>Loans:</b> Micro-loans ranging from ₹1.5 Lakh to ₹5 Lakh for women entrepreneurs.\n• <b>Activities:</b> Tailoring, Dairy, Handicrafts, Organic Farming, and Micro-business.\n• <b>Registration:</b> Form a group via Gram Panchayat Samuh Sakhi.`,
    actions: [
      { labelHi: 'समूह योजना देखें', labelMr: 'बचत गट योजना पहा', labelEn: 'Explore SHG Scheme', tab: 'tab-services', scheme: 'Self-Help Group (NRLM) Registration' }
    ]
  },
  SOIL: {
    hi: `<b>मृदा स्वास्थ्य कार्ड (Soil Health Card) एवं खाद दरें:</b>\n\n• <b>मिट्टी जांच:</b> निःशुल्क पोषक तत्व जांच (N, P, K, pH स्तर) पंचायत कृषि केंद्र पर उपलब्ध।\n• <b>सरकारी खाद दरें:</b> यूरिया ₹266.50 प्रति बोरी, DAP ₹1,350 प्रति बोरी। PoS मशीन द्वारा बायोमेट्रिक खरीद अनिवार्य।`,
    mr: `<b>मृदा आरोग्य कार्ड आणि खत दर:</b>\n\n• <b>माती परीक्षण:</b> मोफत पोषक तत्व तपासणी उपलब्ध.\n• <b>शासकीय खत दर:</b> युरिया ₹266.50/पोते, DAP ₹1,350/पोते आधार बायोमेट्रिकद्वारे.`,
    en: `<b>Soil Health Card & Subsidized Fertilizers:</b>\n\n• <b>Soil Testing:</b> Free soil testing for NPK levels at the local Agriculture Service Center.\n• <b>Subsidized Rates:</b> Urea ₹266.50/bag, DAP ₹1,350/bag via Aadhaar PoS biometric purchase.`
  },
  WEATHER: {
    hi: `<b>मौसम एवं कृषि सलाह:</b>\n\n• <b>मौसम अनुमान:</b> अगले 3 दिनों में आंशिक बादल छाये रहने और हल्की वर्षा की संभावना।\n• <b>कीट नियंत्रण:</b> फसलों में कीट या फफूंद दिखने पर नजदीकी ब्लॉक कृषि अधिकारी या 1551 किसान कॉल सेंटर पर संपर्क करें।`,
    mr: `<b>हवामान आणि शेती सल्ला:</b>\n\n• <b>हवामान अंदाज:</b> पुढील 3 दिवसांत हलक्या पावसाची शक्यता.\n• <b>कीड नियंत्रण:</b> अधिक माहितीसाठी 1551 किसान कॉल सेंटरवर संपर्क साधा.`,
    en: `<b>Weather & Farm Advisory:</b>\n\n• <b>Forecast:</b> Partially cloudy with light rain expected over the next 3 days.\n• <b>Pest Control:</b> For crop disease queries, dial 1551 (Kisan Call Center).`
  },
  SCHOLARSHIP: {
    hi: `<b>ग्रामीण छात्रवृत्ति एवं शिक्षा सहायता:</b>\n\n• <b>योजनाएं:</b> प्री-मैट्रिक (कक्षा 9-10) एवं पोस्ट-मैट्रिक छात्रवृत्ति (SC/ST/OBC/EWS हेतु)।\n• <b>दस्तावेज़:</b> आय प्रमाण पत्र, जाति प्रमाण, आधार कार्ड, बैंक खाता, और आय सीमा (₹2.5 लाख तक)।`,
    mr: `<b>ग्रामीण शिष्यवृत्ती योजना:</b>\n\n• <b>योजना:</b> मॅट्रिकपूर्व व मॅट्रिकोत्तर शिष्यवृत्ती.\n• <b>कागदपत्रे:</b> उत्पन्न दाखला, जात दाखला, आधार कार्ड आणि बँक पासबुक.`,
    en: `<b>Rural Student Scholarships:</b>\n\n• <b>Programs:</b> Pre-Matric and Post-Matric Scholarships for SC/ST/OBC/EWS students.\n• <b>Documents:</b> Income Certificate, Caste Certificate, Aadhaar, Bank Passbook.`
  },
  GRAM_SABHA: {
    hi: `<b>ग्राम सभा बैठक एवं निर्णय प्रक्रिया:</b>\n\n• <b>वार्षिक बैठकें:</b> 26 जनवरी, 1 मई, 15 अगस्त और 2 अक्टूबर।\n• <b>अधिकार:</b> प्रत्येक 18+ मतदाता ग्राम सभा बैठक में प्रस्ताव रख सकते हैं और विकास कार्यों की समीक्षा कर सकते हैं।`,
    mr: `<b>ग्रामसभा बैठक आणि अधिकार:</b>\n\n• <b>बैठका:</b> 26 जानेवारी, 1 मे, 15 ऑगस्ट आणि 2 ऑक्टोबर.\n• <b>अधिकार:</b> सर्व १८+ मतदार ग्रामसभेत विकासकामांवर प्रस्ताव मांडू शकतात.`,
    en: `<b>Gram Sabha Meetings & Civic Rights:</b>\n\n• <b>Schedule:</b> Mandatory meetings on 26 Jan, 1 May, 15 Aug, and 2 Oct.\n• <b>Rights:</b> All registered voters can propose village development projects.`
  },
  LIVESTOCK: {
    hi: `<b>पशुपालन एवं पशु स्वास्थ्य सहायता:</b>\n\n• <b>पशु बीमा (Pashu Bima):</b> 70% सब्सिडी पर गाय व भैंस हेतु बीमा योजना।\n• <b>टीकाकरण:</b> खुरपका-मुंहपका (FMD) निःशुल्क टीकाकरण ड्राइव जारी है।\n• <b>पशु डॉक्टर हेल्पलाइन:</b> 1962 (डोरस्टेप पशु चिकित्सा सेवा)।`,
    mr: `<b>पशुसंवर्धन आणि पशुवैद्यकीय मदत:</b>\n\n• <b>पशू विमा:</b> ७०% अनुदानावर गाय व म्हशींसाठी विमा.\n• <b>हेल्पलाईन:</b> १९६२ वर संपर्क साधा.`,
    en: `<b>Livestock & Veterinary Care:</b>\n\n• <b>Cattle Insurance:</b> 70% subsidized insurance for cattle and buffaloes.\n• <b>Free Vaccination:</b> FMD vaccination drives active.\n• <b>Veterinary Helpline:</b> Dial 1962 for doorstep cattle treatment.`
  },
  RATION: {
    hi: `<b>राशन कार्ड सेवा गाइड:</b>\n\n• <b>पात्रता:</b> बीपीएल / पात्र गृहस्थी राशन कार्ड हेतु आय प्रमाण पत्र आवश्यक है।\n• <b>दस्तावेज़:</b> परिवार के सभी सदस्यों के आधार कार्ड, आय प्रमाण पत्र, निवास प्रमाण।`,
    mr: `<b>रेशन कार्ड सेवा मार्गदर्शक:</b>\n\n• <b>आवश्यक कागदपत्रे:</b> सर्व सदस्यांचे आधार कार्ड, उत्पन्नाचा दाखला आणि रहिवासी दाखला.`,
    en: `<b>Ration Card Services Guide:</b>\n\n• <b>Documents Needed:</b> Aadhaar card for all family members, Income Certificate, and Address proof.`,
    actions: [
      { labelHi: 'राशन कार्ड सेवा लागू करें', labelMr: 'रेशन कार्ड अर्ज करा', labelEn: 'Apply Ration Card', tab: 'tab-services', scheme: 'Ration Card Member Addition' }
    ]
  },
  BHULEKH: {
    hi: `<b>भूलेख (खतौनी/खसरा) जानकारी:</b>\n\n• अपनी जमीन की खतौनी एवं खसरा संख्या आप तुरंत देख सकते हैं।\n• नामांतरण (दाखिल-खारिज) के लिए लेखपाल सत्यापन रिपोर्ट तैयार करते हैं।`,
    mr: `<b>भूलेख व जमीन नोंदी (7/12 उतारा):</b>\n\n• महाभूलेख पोर्टलवरून तुमचा 7/12 व 8A उतारा मिळवा.\n• फेरफार नोंदीसाठी तलाठी कार्यालयाशी संपर्क साधा.`,
    en: `<b>Land Records (Bhulekh / Khatauni):</b>\n\n• Access digital land records and verify plot ownership status.\n• Ownership transfer is reviewed directly by the Village Lekhpal.`,
    actions: [
      { labelHi: 'भूलेख ऑनलाइन देखें', labelMr: '7/12 उतारा पहा', labelEn: 'View Land Records', tab: 'tab-services', scheme: 'Land Records (Bhulekh)' }
    ]
  },
  AYUSHMAN: {
    hi: `<b>आयुष्मान भारत कार्ड:</b>\n\n• प्रति परिवार प्रति वर्ष ₹5 लाख तक का मुफ्त इलाज।\n• आधार कार्ड एवं राशन कार्ड के साथ निकटतम पंचायत जन सेवा केंद्र (CSC) जाएँ।`,
    mr: `<b>आयुष्मान भारत कार्ड:</b>\n\n• प्रति कुटुंब दरवर्षी ₹5 लाखांपर्यंत मोफत उपचार.\n• आधार आणि रेशन कार्डसह जनसेवा केंद्राला भेट द्या.`,
    en: `<b>Ayushman Bharat Scheme:</b>\n\n• Free secondary hospital care up to ₹5 Lakh per family annually.\n• Bring Aadhaar and Ration Card to the Panchayat CSC Center to generate your card.`
  },
  CERTIFICATE: {
    hi: `<b>प्रमाण पत्र सेवाएं:</b> आय, निवास, जाति और जन्म प्रमाण पत्र के लिए पहचान पत्र, पता प्रमाण और संबंधित दस्तावेज़ साथ रखें। आवेदन पंचायत सेवा केंद्र पर जमा किया जा सकता है।`,
    mr: `<b>प्रमाणपत्र सेवा:</b> उत्पन्न, रहिवासी, जात व जन्म दाखल्यासाठी कागदपत्रांसह पंचायत सेवा केंद्रात अर्ज करा.`,
    en: `<b>Certificate Services:</b> For income, residence, caste, or birth certificates, keep your identity proof, address proof, and supporting documents ready. Applications can be submitted at the Panchayat service center.`,
    actions: [
      { labelHi: 'सेवाएं देखें', labelMr: 'सर्व सेवा पहा', labelEn: 'Browse Services', tab: 'tab-services' }
    ]
  },
  PENSION: {
    hi: `<b>वृद्धावस्था एवं विधवा पेंशन योजना:</b>\n\n• <b>पात्रता:</b> 60 वर्ष से अधिक आयु के नागरिक एवं विधवा महिलाएं।\n• <b>दस्तावेज़:</b> आयु प्रमाण, बैंक पासबुक, आय प्रमाण, आधार कार्ड।`,
    mr: `<b>पेन्शन योजना (वृद्धापकाळ व विधवा पेन्शन):</b>\n\n• <b>पात्रता:</b> ६० वर्षांपेक्षा जास्त वय असणारे नागरिक व विधवा महिला.\n• <b>कागदपत्रे:</b> वयाचा दाखला, पासबुक, आधार कार्ड.`,
    en: `<b>Pension Schemes:</b>\n\n• <b>Eligibility:</b> Senior Citizens (60+ yrs) and Widows.\n• <b>Documents:</b> Age proof, Bank Passbook, Income Certificate, Aadhaar.`,
    actions: [
      { labelHi: 'पेंशन के लिए आवेदन करें', labelMr: 'पेन्शनसाठी अर्ज करा', labelEn: 'Apply for Pension', tab: 'tab-services', scheme: 'Old Age Pension Scheme' }
    ]
  },
  AWAS: {
    hi: `<b>प्रधानमंत्री आवास योजना (ग्रामीण):</b>\n\n• पक्के मकान निर्माण हेतु ₹1,20,000 की सहायता 3 किस्तों में।\n• चयन ग्राम सभा की सर्वे सूची के आधार पर होता है।`,
    mr: `<b>PM आवास योजना (ग्रामीण):</b>\n\n• पक्के घर बांधण्यासाठी ₹1,20,000 ची मदत 3 हप्त्यांमध्ये.`,
    en: `<b>PM Awas Housing Scheme:</b>\n\n• ₹1,20,000 assistance in 3 installments for constructing a pucca house.`
  },
  COMPLAINT: {
    hi: `<b>समस्या समाधान:</b>\n\nयदि आपके क्षेत्र में पानी, बिजली, सड़क या सफाई की समस्या है, तो आप तुरंत फोटो एवं जीपीएस लोकेशन के साथ शिकायत दर्ज कर सकते हैं!`,
    mr: `<b>नागरी तक्रार निवारण:</b>\n\nपाणी, वीज, रस्ते किंवा स्वच्छतेच्या समस्येसाठी फोटोसह तक्रार नोंदवा!`,
    en: `<b>Filing Civic Complaints:</b>\n\nFor issues with water, broken lights, or roads, submit a complaint with photo and GPS location!`,
    actions: [
      { labelHi: 'अभी शिकायत दर्ज करें', labelMr: 'आत्ताच तक्रार नोंदवा', labelEn: 'File Complaint Now', tab: 'tab-report' }
    ]
  },
  HELPLINE: {
    hi: `<b>ग्राम पंचायत महत्वपूर्ण संपर्क:</b>\n\n• ग्राम प्रधान कार्यालय: ग्राम पंचायत भवन\n• आपातकालीन हेल्पलाइन: 112 (पुलिस), 108 (एम्बुलेंस), 1090 (महिला हेल्पलाइन), 1551 (किसान कॉल सेंटर), 1962 (पशु चिकित्सा)`,
    mr: `<b>ग्रामपंचायत महत्वाचे संपर्क:</b>\n\n• ग्रामपंचायत कार्यालय: पंचायत भवन\n• आपत्कालीन: 112 (पोलीस), 108 (ॲम्बुलन्स), 1551 (किसान कॉल सेंटर), 1962 (पशुवैद्यकीय)`,
    en: `<b>Village Officers & Helplines:</b>\n\n• Gram Panchayat Office: Gram Panchayat Bhavan\n• Emergency Lines: 112 (Police), 108 (Ambulance), 1090 (Women Helpline), 1551 (Kisan Call Center), 1962 (Veterinary)`
  }
};

const INTENT_TITLE_MAP = {
  PMKISAN: { hi: 'PM-किसान योजना', mr: 'PM-किसान योजना', en: 'PM-Kisan Scheme' },
  SOLAR: { hi: 'PM-कुसुम सौर पंप', mr: 'सोलर पंप योजना', en: 'Solar Pump Scheme' },
  MGNREGA: { hi: 'मनरेगा रोजगार', mr: 'मनरेगा रोजगार', en: 'MGNREGA Job Card' },
  SHG: { hi: 'महिला स्वयं सहायता समूह', mr: 'महिला बचत गट', en: 'Self-Help Group (SHG)' },
  SOIL: { hi: 'मृदा स्वास्थ्य व खाद', mr: 'माती चाचणी व खत', en: 'Soil Health & Fertilizer' },
  WEATHER: { hi: 'मौसम व कृषि सलाह', mr: 'हवामान व शेती सल्ला', en: 'Weather & Crop Advisory' },
  SCHOLARSHIP: { hi: 'छात्रवृत्ति सहायता', mr: 'शिष्यवृत्ती योजना', en: 'Student Scholarship' },
  GRAM_SABHA: { hi: 'ग्राम सभा बैठक', mr: 'ग्रामसभा बैठक', en: 'Gram Sabha Meeting' },
  LIVESTOCK: { hi: 'पशुपालन व बीमा', mr: 'पशुसंवर्धन व विमा', en: 'Livestock & Veterinary' },
  RATION: { hi: 'राशन कार्ड सेवा', mr: 'रेशन कार्ड सेवा', en: 'Ration Card' },
  BHULEKH: { hi: 'भूलेख व खतौनी', mr: '7/12 व जमीन नोंद', en: 'Land Records (Bhulekh)' },
  AYUSHMAN: { hi: 'आयुष्मान भारत कार्ड', mr: 'आयुष्मान भारत कार्ड', en: 'Ayushman Bharat Card' },
  CERTIFICATE: { hi: 'प्रमाण पत्र सेवाएं', mr: 'प्रमाणपत्र सेवा', en: 'Certificates' },
  PENSION: { hi: 'वृद्धावस्था पेंशन', mr: 'पेन्शन योजना', en: 'Pension Schemes' },
  AWAS: { hi: 'PM आवास योजना', mr: 'PM आवास योजना', en: 'PM Awas Housing' },
  COMPLAINT: { hi: 'समस्या शिकायत दर्ज', mr: 'तक्रार नोंदणी', en: 'File Civic Complaint' },
  HELPLINE: { hi: 'ग्राम पंचायत हेल्पलाइन', mr: 'पंचायत हेल्पलाईन', en: 'Panchayat Helplines' },
  STATUS: { hi: 'वास्तविक समय स्थिति', mr: 'थेट स्थिती', en: 'Real-Time Status' }
};

function buildResponse(key, lang = 'en') {
  const item = DICTIONARY[key];
  if (!item) return null;
  const reply = item[lang] || item['hi'] || item['en'];
  let actions;
  if (item.actions) {
    actions = item.actions.map(a => ({
      label: (lang === 'mr' ? a.labelMr : (lang === 'hi' ? a.labelHi : a.labelEn)) || a.labelEn,
      tab: a.tab,
      ...(a.scheme ? { scheme: a.scheme } : {})
    }));
  }
  return { reply, ...(actions ? { actions } : {}) };
}

async function handleLiveStatusLookup(citizenId, dbAsync, lang = 'en') {
  const queryCitizenId = citizenId || 'CITIZEN-DEMO';
  try {
    const reports = await dbAsync.all('SELECT id, category, status, priority FROM complaints WHERE citizen_id = ? ORDER BY created_at DESC LIMIT 3', [queryCitizenId]);
    const apps = await dbAsync.all('SELECT id, scheme_type, status, progress_pct FROM applications WHERE citizen_id = ? ORDER BY created_at DESC LIMIT 3', [queryCitizenId]);

    if ((!reports || reports.length === 0) && (!apps || apps.length === 0)) {
      return {
        reply: lang === 'mr'
          ? `नमस्कार! सध्या तुमच्या खात्यासाठी (${queryCitizenId}) कोणतीही तक्रार किंवा अर्ज नोंदवलेला नाही. तुम्ही खालील बटणांवरून नवीन अर्ज करू शकता:`
          : (lang === 'hi'
            ? `नमस्ते! वर्तमान में आपके खाते (${queryCitizenId}) के लिए कोई सक्रिय शिकायत या आवेदन दर्ज नहीं है। आप नीचे दिए गए बटन से नया आवेदन कर सकते हैं:`
            : `Namaste! Currently there are no active complaints or applications registered for your account (${queryCitizenId}). You can submit a request below:`),
        actions: [
          { label: lang === 'mr' ? 'समस्या नोंदवा' : (lang === 'hi' ? 'समस्या रिपोर्ट करें' : 'Report a Problem'), tab: 'tab-report' },
          { label: lang === 'mr' ? 'योजना पहा' : (lang === 'hi' ? 'योजनाएं देखें' : 'Browse Schemes'), tab: 'tab-services' }
        ]
      };
    }

    let summary = lang === 'mr'
      ? `📊 <b>तुमची थेट स्थिती (${queryCitizenId}):</b>\n\n`
      : (lang === 'hi' ? `📊 <b>आपकी वास्तविक समय स्थिति (${queryCitizenId}):</b>\n\n` : `📊 <b>Your Real-Time Live Status (${queryCitizenId}):</b>\n\n`);

    if (reports && reports.length > 0) {
      summary += lang === 'mr' ? `<b>तक्रारी (Complaints):</b>\n` : (lang === 'hi' ? `<b>शिकायतें (Complaints):</b>\n` : `<b>Complaints:</b>\n`);
      reports.forEach(r => {
        summary += `• [${r.id}] ${r.category}: ${r.status} (${r.priority})\n`;
      });
    }
    if (apps && apps.length > 0) {
      summary += lang === 'mr' ? `\n<b>अर्ज (Applications):</b>\n` : (lang === 'hi' ? `\n<b>योजना आवेदन (Applications):</b>\n` : `\n<b>Scheme Applications:</b>\n`);
      apps.forEach(a => {
        summary += `• [${a.id}] ${a.scheme_type}: ${a.status} (${a.progress_pct}%)\n`;
      });
    }

    return {
      reply: summary,
      actions: [{ label: lang === 'mr' ? 'प्रोफाईलमध्ये पहा' : (lang === 'hi' ? 'प्रोफाइल में देखें' : 'View in Profile'), tab: 'tab-profile' }]
    };
  } catch (e) {
    console.error("NLP DB lookup error:", e);
    return null;
  }
}

const GREETING_REGEX = /^(hey|hello|hi|namaste|namskar|pranam|ram ram|namaskar|नमस्ते|नमस्कार|हेलो|हाय|हॅलो|हाय्य)$/i;

function matchSmallTalk(input, lang) {
  const text = (input || '').toLowerCase().trim();

  // 1. Identity / Who are you
  if (/(who are you|what is your name|who built you|who created you| तुम कौन हो|तुम्हारा नाम क्या है|तू कोण आहेस|तुझे नाव काय)/i.test(text)) {
    return buildResponse('WHO_ARE_YOU', lang);
  }

  // 2. Capabilities / What can you do
  if (/(what can you do|how can you help|help me|features|तुम क्या कर सकते हो|मेरी मदद करो|क्या कर सकते हो|तू काय करू शकतोस|मदत करा)/i.test(text)) {
    return buildResponse('WHAT_CAN_YOU_DO', lang);
  }

  // 3. Compliment / Thanks
  if (/(good job|great|smart|awesome|nice work|thank you|thanks|शाबाश|बढ़िया|बहुत अच्छे|धन्यवाद|खूप छान|छान|उत्तम)/i.test(text)) {
    return buildResponse('COMPLIMENT', lang);
  }

  // 4. Farewell
  if (/(bye|goodbye|see you|good night|अलविदा|शुभ रात्रि|पुन्हा भेटू|शुभ रात्री)/i.test(text)) {
    return buildResponse('FAREWELL', lang);
  }

  // 5. Sarpanch / Panchayat Info
  if (/(who is sarpanch|panchayat secretary|where is panchayat|प्रधान कौन है|सरपंच कौन हैं|पंचायत भवन|सरपंच कोण|पंचायत कार्यालय)/i.test(text)) {
    return buildResponse('SARPANCH_INFO', lang);
  }

  // 6. How to apply
  if (/(how to apply|application process|documents required|आवेदन कैसे करें|फॉर्म कैसे भरें|अर्ज कसा करावा)/i.test(text)) {
    return buildResponse('HOW_TO_APPLY', lang);
  }

  return null;
}

const COMPLAINT_TRIGGER_REGEX = /(report|complaint|file complaint|issue|problem|broken|leak|leaking|no water|water supply|pothole|road damage|garbage|trash|waste|gutter|drain|no electricity|power cut|street light|light off|तार|खराब|तक्रार|शिकायत|लीकेज|पाणी|पानी|वीज|बिजली|रस्ता|सड़क|कचरा|नाली|लाइट)/i;

function detectCategory(text) {
  const t = (text || '').toLowerCase();
  if (/water|leak|pipe|borewell|tank|पाणी|पानी|नल|लीकेज/i.test(t)) return 'Water Supply';
  if (/electric|power|light|wire|pole|transformer|वीज|बिजली|लाइट|पोल/i.test(t)) return 'Electricity';
  if (/road|pothole|asphalt|bridge|रस्ता|सड़क|गड्ढा|खड्डा/i.test(t)) return 'Roads';
  if (/garbage|trash|waste|gutter|drain|cleanliness|कचरा|नाली|सफाई|गटार/i.test(t)) return 'Sanitation';
  if (/street light|lamp|darkness|पथदिवे|स्ट्रीट/i.test(t)) return 'Street Lights';
  return 'Civic Infrastructure';
}

function detectPriorityHelper(text, category) {
  const t = (text || '').toLowerCase();
  if (/fire|wire|spark|fallen|flood|emergency|danger|तार|खतरा|आग/i.test(t)) return 'Critical';
  if (/leak|no water|broken|sewage|खराब|लीकेज|तक्रार/i.test(t)) return 'High';
  if (category === 'Water Supply' || category === 'Electricity') return 'Medium';
  return 'Low';
}

async function handleAutomatedComplaintReporting(input, citizenId, dbAsync, lang = 'en', io = null) {
  const text = (input || '').trim();
  const lower = text.toLowerCase();
  
  // If the query is just a generic prompt like "complaint" or "file issue" without details:
  const isGenericPrompt = text.split(/\s+/).length <= 2 && /^(complaint|report|issue|takraar|shikayat|तक्रार|शिकायत)$/i.test(lower);
  if (isGenericPrompt) {
    return {
      reply: lang === 'mr'
        ? `तुम्हाला कोणती नागरी समस्या नोंदवायची आहे? कृपया संक्षिप्त माहिती सांगा (उदा. 'वॉर्ड २ मध्ये पाण्याची पाईप गळती' किंवा 'मुख्य रस्त्यावर पथदिवा बंद').`
        : (lang === 'hi'
          ? `आप कौन सी नागरिक समस्या रिपोर्ट करना चाहते हैं? कृपया विवरण दें (जैसे 'वार्ड 2 में पानी की पाइप लीकेज' या 'मुख्य मार्ग पर लाइट खराब')।`
          : `What issue would you like to report? Please describe the problem (e.g., 'Water leak in Ward 2' or 'Street light broken near main road').`),
      actions: [
        { label: lang === 'mr' ? 'तक्रार फॉर्म उघडा' : (lang === 'hi' ? 'शिकायत फॉर्म खोलें' : 'Open Complaint Form'), tab: 'tab-report' }
      ]
    };
  }

  const category = detectCategory(text);
  const priority = detectPriorityHelper(text, category);
  const reportId = `#REP-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Retrieve citizen user info
  let user = null;
  if (dbAsync && citizenId) {
    try {
      user = await dbAsync.findOne('users', { id: citizenId });
    } catch(e) {}
  }
  const uId = (user && user.id) ? user.id : (citizenId || 'CIT-001');
  const uName = (user && user.name) ? user.name : 'Rajesh Kumar';

  const reportData = {
    id: reportId,
    category,
    location: 'Panchayat Area / Citizen Ward',
    description: text,
    photo_url: null,
    status: 'Pending',
    priority,
    citizen_id: uId,
    citizen_name: uName,
    date: todayStr,
    created_at: new Date(),
    updated_at: new Date()
  };

  if (dbAsync) {
    try {
      await dbAsync.insert('reports', reportData);
    } catch(e) {
      console.error("Error inserting automated chat report:", e);
    }
  }

  // Broadcast WebSockets to Admin Dashboard and Citizen in real time!
  if (io) {
    io.to('admins').emit('report_created', reportData);
    io.to(`citizen:${uId}`).emit('report_created', reportData);
  }

  let replyText = '';
  if (lang === 'mr') {
    replyText = `🚨 <b>तक्रार आपोआप नोंदवली गेली आहे!</b>\n\n• <b>तक्रार संदर्भ:</b> <code>${reportId}</code>\n• <b>प्रवर्ग:</b> ${category}\n• <b>प्राधान्य:</b> ${priority}\n• <b>स्थिती:</b> प्रलंबित (Pending Review)\n\n<i>तुमची समस्या थेट ग्रामपंचायत सचिव व ॲडमिन डॅशबोर्डवर तात्काळ नोंदवण्यात आली आहे.</i>`;
  } else if (lang === 'hi') {
    replyText = `🚨 <b>आपकी शिकायत स्वचालित रूप से दर्ज हो गई है!</b>\n\n• <b>शिकायत संदर्भ:</b> <code>${reportId}</code>\n• <b>श्रेणी:</b> ${category}\n• <b>प्राथमिकता:</b> ${priority}\n• <b>स्थिति:</b> लंबित (Pending Review)\n\n<i>आपकी समस्या सीधे ग्राम पंचायत अधिकारी एवं एडमिन डैशबोर्ड पर पंजीकृत कर दी गई है।</i>`;
  } else {
    replyText = `🚨 <b>Complaint Ticket Filed Automatically!</b>\n\n• <b>Ticket Ref:</b> <code>${reportId}</code>\n• <b>Category:</b> ${category}\n• <b>Priority:</b> ${priority}\n• <b>Status:</b> Pending Review\n\n<i>Your issue has been automatically registered with the Gram Panchayat Secretary & Admin Dashboard in real-time.</i>`;
  }

  return {
    reply: replyText,
    actions: [
      {
        label: lang === 'mr' ? 'तक्रारीची स्थिती पहा' : (lang === 'hi' ? 'शिकायत की स्थिति देखें' : 'View Ticket Status'),
        tab: 'tab-profile'
      }
    ]
  };
}

async function processUserQuery(text, citizenId, dbAsync, preferredLang = 'en', sessionId = null, io = null) {
  const input = (text || '').trim();

  // Determine Language
  let lang = preferredLang === 'mr' ? 'mr' : (preferredLang === 'hi' ? 'hi' : 'en');
  if (preferredLang !== 'mr' && preferredLang !== 'hi') {
    if (/[आ-ह]/.test(input) && (input.includes('काय') || input.includes('आहे') || input.includes('माझे') || input.includes('तक्रार') || input.includes('नमस्कार'))) {
      lang = 'mr';
    } else if (/[अ-ह]/.test(input)) {
      lang = 'hi';
    }
  }

  // Intercept Simple Greetings
  if (!input || GREETING_REGEX.test(input)) {
    if (lang === 'mr') {
      return {
        reply: `नमस्कार! मी ग्राम सहायक आहे, तुमचा ग्राम पंचायतीचा डिजिटल साहाय्यक. आज मी तुम्हाला कशी मदत करू शकतो?`,
        actions: [
          { label: 'सेवा पहा', tab: 'tab-services' },
          { label: 'तक्रार नोंदवा', tab: 'tab-report' }
        ]
      };
    } else if (lang === 'hi') {
      return {
        reply: `नमस्ते! मैं ग्राम सहायक हूँ, आपका ग्राम पंचायत का डिजिटल सहायक। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
        actions: [
          { label: 'सेवाएं देखें', tab: 'tab-services' },
          { label: 'शिकायत करें', tab: 'tab-report' }
        ]
      };
    } else {
      return {
        reply: `Namaste! Hello! I am Gram Sahayak, your digital assistant for Gram Panchayat. How can I help you today?`,
        actions: [
          { label: 'Browse Services', tab: 'tab-services' },
          { label: 'Report Issue', tab: 'tab-report' }
        ]
      };
    }
  }

  // Intercept Small Talk Conversational Queries
  const smallTalkResponse = matchSmallTalk(input, lang);
  if (smallTalkResponse) {
    logNLUEvent(dbAsync, {
      text: input,
      intent: 'SMALL_TALK',
      confidence: 1.0,
      final_action: 'SMALL_TALK',
      language: lang,
      citizen_id: citizenId
    });
    return smallTalkResponse;
  }

  // Intercept Direct In-Chat Complaint Reporting
  if (COMPLAINT_TRIGGER_REGEX.test(input)) {
    logNLUEvent(dbAsync, {
      text: input,
      intent: 'COMPLAINT_AUTO',
      confidence: 1.0,
      final_action: 'AUTO_REPORT',
      language: lang,
      citizen_id: citizenId
    });
    return await handleAutomatedComplaintReporting(input, citizenId, dbAsync, lang, io);
  }

  // Step 1: Call Python NLU Microservice
  const nluData = await parseNLU(input, sessionId);

  let intent = nluData ? nluData.intent : null;
  let confidence = nluData ? nluData.confidence : 0.0;
  let entities = nluData ? nluData.entities : [];
  let intentsRanked = nluData ? nluData.intents_ranked : [];

  // Step 2: Dialogue Manager & Context Carry-Over
  const contextCheck = resolveContextCarryOver(sessionId, intent, input);
  if (contextCheck.isContextual && contextCheck.carriedIntent) {
    intent = contextCheck.carriedIntent;
    confidence = 0.95;
  }

  updateSession(sessionId, intent, entities);

  let finalAction = 'DIRECT';
  let result = null;

  // Step 3: 3-Tier Confidence Gater
  if (intent === 'COMPLAINT') {
    result = await handleAutomatedComplaintReporting(input, citizenId, dbAsync, lang, io);
  } else if (nluData && confidence >= 0.75) {
    finalAction = 'EXECUTE_DIRECT';
    if (intent === 'STATUS') {
      result = await handleLiveStatusLookup(citizenId, dbAsync, lang);
    } else {
      result = buildResponse(intent, lang);
    }
  } else if (nluData && confidence >= 0.45 && confidence < 0.75 && intentsRanked.length >= 2) {
    finalAction = 'DISAMBIGUATION';
    const top1 = intentsRanked[0].intent;
    const top2 = intentsRanked[1].intent;
    const title1 = INTENT_TITLE_MAP[top1] ? (INTENT_TITLE_MAP[top1][lang] || INTENT_TITLE_MAP[top1].en) : top1;
    const title2 = INTENT_TITLE_MAP[top2] ? (INTENT_TITLE_MAP[top2][lang] || INTENT_TITLE_MAP[top2].en) : top2;

    result = {
      reply: lang === 'mr'
        ? `तुम्हाला <b>${title1}</b> किंवा <b>${title2}</b> बद्दल माहिती हवी आहे का? कृपया निवड करा:`
        : (lang === 'hi'
          ? `क्या आपका अभिप्राय <b>${title1}</b> या <b>${title2}</b> की जानकारी प्राप्त करना है? कृपया चयन करें:`
          : `Did you mean <b>${title1}</b> or <b>${title2}</b>? Please select an option below:`),
      actions: [
        { label: title1, tab: 'tab-services', query: top1 },
        { label: title2, tab: 'tab-services', query: top2 }
      ]
    };
  } else {
    finalAction = 'FALLBACK';
    result = {
      reply: lang === 'mr'
        ? `नमस्कार! तुमच्या "${input}" या प्रश्नाबद्दल:\n\nमी ग्राम सहायक आहे. मी तुम्हाला ग्राम पंचायत सेवा (PM-किसान, सोलर पंप, मनरेगा, रेशन कार्ड, भूलेख, पेन्शन) आणि नागरी तक्रारी नोंदवण्यात मदत करू शकतो.`
        : (lang === 'hi'
          ? `नमस्ते! आपके प्रश्न "${input}" के बारे में:\n\nमैं ग्राम सहायक हूँ। मैं आपको ग्राम पंचायत सेवाओं (PM-किसान, सौर पंप, मनरेगा, स्वयं सहायता समूह, राशन कार्ड, भूलेख, पेंशन) एवं शिकायत दर्ज करने में मदद कर सकता हूँ।`
          : `Namaste! Regarding your query about "${input}":\n\nI am Gram Sahayak, your rural assistant. I can guide you through local schemes (PM-Kisan, Solar Pump, MGNREGA, SHG Groups, Ration Card, Bhulekh, Pensions) or help you file complaints.`),
      actions: [
        { label: lang === 'mr' ? 'सेवा पहा' : (lang === 'hi' ? 'सेवाएं देखें' : 'Browse Services'), tab: 'tab-services' },
        { label: lang === 'mr' ? 'तक्रार नोंदवा' : (lang === 'hi' ? 'शिकायत करें' : 'Report Issue'), tab: 'tab-report' }
      ]
    };
  }

  // Step 4: Async Logging
  logNLUEvent(dbAsync, {
    text: input,
    intent: intent || 'UNKNOWN',
    confidence,
    final_action: finalAction,
    language: lang,
    citizen_id: citizenId
  });

  return result;
}

module.exports = { processUserQuery };