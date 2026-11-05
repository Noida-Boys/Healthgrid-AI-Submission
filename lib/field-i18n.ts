// Field-screen strings in the worker's chosen language. Deliberately tiny —
// three locales, one screen — no i18n framework needed.

export type Lang = "hi" | "mr" | "en";

export const LANGS: { code: Lang; native: string; english: string }[] = [
  { code: "hi", native: "हिंदी", english: "Hindi" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "en", native: "English", english: "English" },
];

export interface FieldStrings {
  fieldTag: string;
  chooseLanguage: string;
  chooseLanguageSub: string;
  voiceTitle: string;
  voiceHint: string;
  example: string;
  holdToTalk: string;
  listening: string;
  understanding: string;
  youSaid: string;
  confirm: string;
  cancel: string;
  notUnderstood: string;
  tryAgain: string;
  saving: string;
  updated: string;
  updatedSub: string;
  micDenied: string;
  audioFailed: string;
  updateFailed: string;
  quickUpdates: string;
  medicineStock: string;
  bedsOccupied: string;
  doctorsPresent: string;
  tests: string;
  save: string;
  available: string;
  down: string;
  tapIfDown: string;
  tapWhenRestored: string;
  score: string;
  beds: string;
  doctors: string;
  commandCenter: string;
  loading: string;
  savedScore: string;
}

export const STRINGS: Record<Lang, FieldStrings> = {
  hi: {
    fieldTag: "फ्रंटलाइन अपडेट",
    chooseLanguage: "अपनी भाषा चुनें",
    chooseLanguageSub: "Choose your language",
    voiceTitle: "आवाज़ से अपडेट",
    voiceHint: "बटन दबाए रखें और बोलें",
    example: "आज ओआरएस का स्टॉक 50 बचा है",
    holdToTalk: "दबाकर बोलें",
    listening: "सुन रहे हैं… छोड़ते ही भेजा जाएगा",
    understanding: "समझा जा रहा है…",
    youSaid: "आपने कहा",
    confirm: "पुष्टि करें",
    cancel: "रद्द करें",
    notUnderstood: "समझ नहीं आया — कृपया धीरे और साफ़ बोलें।",
    tryAgain: "फिर से बोलें",
    saving: "अपडेट हो रहा है…",
    updated: "अपडेट हो गया",
    updatedSub: "ज़िला कमांड सेंटर तुरंत अपडेट हुआ",
    micDenied: "माइक्रोफ़ोन की अनुमति नहीं मिली।",
    audioFailed: "आवाज़ प्रोसेस नहीं हो सकी।",
    updateFailed: "अपडेट नहीं हो सका — फिर से कोशिश करें।",
    quickUpdates: "क्विक अपडेट",
    medicineStock: "दवा स्टॉक",
    bedsOccupied: "भरे बिस्तर",
    doctorsPresent: "डॉक्टर उपस्थित",
    tests: "जाँच",
    save: "सेव करें",
    available: "उपलब्ध",
    down: "बंद",
    tapIfDown: "बंद होने पर टैप करें",
    tapWhenRestored: "चालू होने पर टैप करें",
    score: "स्कोर",
    beds: "बिस्तर",
    doctors: "डॉक्टर",
    commandCenter: "कमांड सेंटर",
    loading: "लोड हो रहा है…",
    savedScore: "सेव हुआ · नया स्कोर",
  },
  mr: {
    fieldTag: "फ्रंटलाइन अपडेट",
    chooseLanguage: "आपली भाषा निवडा",
    chooseLanguageSub: "Choose your language",
    voiceTitle: "आवाजाने अपडेट",
    voiceHint: "बटण दाबून ठेवा आणि बोला",
    example: "आज ओआरएसचा साठा 50 उरला आहे",
    holdToTalk: "दाबून बोला",
    listening: "ऐकत आहोत… सोडताच पाठवले जाईल",
    understanding: "समजून घेत आहोत…",
    youSaid: "तुम्ही म्हणालात",
    confirm: "निश्चित करा",
    cancel: "रद्द करा",
    notUnderstood: "समजले नाही — कृपया हळू आणि स्पष्ट बोला.",
    tryAgain: "पुन्हा बोला",
    saving: "अपडेट होत आहे…",
    updated: "अपडेट झाले",
    updatedSub: "जिल्हा कमांड सेंटर लगेच अपडेट झाले",
    micDenied: "मायक्रोफोनची परवानगी मिळाली नाही.",
    audioFailed: "आवाज प्रोसेस होऊ शकला नाही.",
    updateFailed: "अपडेट होऊ शकले नाही — पुन्हा प्रयत्न करा.",
    quickUpdates: "क्विक अपडेट",
    medicineStock: "औषध साठा",
    bedsOccupied: "भरलेले बेड",
    doctorsPresent: "उपस्थित डॉक्टर",
    tests: "तपासण्या",
    save: "जतन करा",
    available: "उपलब्ध",
    down: "बंद",
    tapIfDown: "बंद असल्यास टॅप करा",
    tapWhenRestored: "सुरू झाल्यावर टॅप करा",
    score: "स्कोर",
    beds: "बेड",
    doctors: "डॉक्टर",
    commandCenter: "कमांड सेंटर",
    loading: "लोड होत आहे…",
    savedScore: "जतन झाले · नवा स्कोर",
  },
  en: {
    fieldTag: "Frontline updates",
    chooseLanguage: "Choose your language",
    chooseLanguageSub: "अपनी भाषा चुनें · आपली भाषा निवडा",
    voiceTitle: "Voice update",
    voiceHint: "Hold the button and speak",
    example: "ORS stock is 50 today",
    holdToTalk: "Hold to talk",
    listening: "Listening… release to send",
    understanding: "Understanding…",
    youSaid: "You said",
    confirm: "Confirm",
    cancel: "Cancel",
    notUnderstood: "Didn't catch that — please speak slowly and clearly.",
    tryAgain: "Speak again",
    saving: "Updating…",
    updated: "Updated",
    updatedSub: "District command center updated live",
    micDenied: "Microphone permission was denied.",
    audioFailed: "Could not process the audio.",
    updateFailed: "Update failed — please try again.",
    quickUpdates: "Quick updates",
    medicineStock: "Medicine stock",
    bedsOccupied: "Beds occupied",
    doctorsPresent: "Doctors present",
    tests: "Tests",
    save: "Save",
    available: "available",
    down: "DOWN",
    tapIfDown: "tap if down",
    tapWhenRestored: "tap when restored",
    score: "Score",
    beds: "Beds",
    doctors: "Doctors",
    commandCenter: "command center",
    loading: "Loading…",
    savedScore: "Saved · new score",
  },
};

export const LANG_NAME: Record<Lang, string> = { hi: "Hindi", mr: "Marathi", en: "English" };
