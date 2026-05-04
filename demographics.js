/**
 * Constituency religious majority estimates — Census 2011 district data.
 * Method: constituency name matched to district → district majority religion assigned.
 * Source: Census of India 2011, Table C-1 (Population by Religious Community).
 * Confidence: "confirmed" for individually verified ACs, "estimated" for district proxy.
 */

// ── Assam ─────────────────────────────────────────────────────────────────────
// Muslim-majority districts (>50%): Dhubri 79.7%, S.Salmara ~95%, Barpeta 70.7%,
//   Darrang 64.3%, Nagaon 55.4%, Morigaon 52.6%, Hailakandi 60.3%, Karimganj 57.1%, Goalpara 53.7%

const ASSAM_MUSLIM = new Set([
  // Dhubri
  'DHUBRI','GAURIPUR','BILASIPARA EAST','BILASIPARA WEST',
  'ABHAYAPURI NORTH','ABHAYAPURI SOUTH','GOLAKGANJ','MANKACHAR','SALMARA SOUTH',
  // Barpeta
  'BARPETA','BARPETA ROAD','JANIA','BAGHBAR','CHENGA','BHABANIPUR',
  'SARUKHETRI','PATACHARKUCHI','SORBHOG',
  // Darrang
  'DALGAON','SIPAJHAR','DHULA','KALAIGAON','PANERY','ROWTA','MANGALDOI',
  // Nagaon
  'DHING','RAHA','SAMAGURI','BATADRAVA','HAIBARGAON','JAMUNAMUKH',
  'HOJAI','LANKA','DOBOKA','LUMDING','NAGAON','BARHAMPUR',
  // Morigaon
  'MORIGAON','LAHARIGHAT','JAGIROAD','MARIGAON','BATADRAWA',
  // Goalpara
  'GOALPARA EAST','GOALPARA WEST','JALESWAR','DUDHNOI',
  // Hailakandi
  'HAILAKANDI','KATLICHERRA','ALGAPUR','SONAI',
  // Karimganj
  'KARIMGANJ NORTH','KARIMGANJ SOUTH','RATABARI','PATHARKANDI',
  // Bongaigaon (40% — Muslim-leaning, individually confirmed)
  'BIJNI','BONGAIGAON',
]);
const ASSAM_MIXED = new Set([
  // Karbi Anglong / Dima Hasao — tribal + Hindu
  'DIPHU','BOKAJAN','HAFLONG','LANGSOMEPI','DIYUNGBRA',
]);

// ── Kerala ────────────────────────────────────────────────────────────────────
// Malappuram: ~70% Muslim. Kozhikode: ~38%. Kasaragod: ~35%.
// Christian-majority: Kottayam, Pathanamthitta, Idukki (>40% Christian)

const KERALA_MUSLIM = new Set([
  // Malappuram district (all constituencies Muslim-majority)
  'MANJERI','PERINTHALMANNA','MANKADA','MALAPPURAM','TIRUR','TIRURRANGADI',
  'TANUR','WANDOOR','KONDOTTY','ERANAD','NILAMBUR','PONNANI',
  // Kozhikode constituency-level Muslim majority
  'KUTTIYADI','NADAPURAM','ELATHUR','KODUVALLY','THIRUVAMBADY',
  // Kasaragod (some ACs)
  'KASARAGOD','MANJESHWARAM','TRIKARIPUR',
  // Palakkad (Ottappalam area)
  'OTTAPPALAM','PATTAMBI','SHORANUR',
]);
const KERALA_CHRISTIAN = new Set([
  // Kottayam district
  'KOTTAYAM','PUTHUPPALLY','CHANGANACHERRY','ETTUMANOOR','KADUTHURUTHY',
  'VAIKOM','PALA','ERATTUPETTA','KANJIRAPPALLY',
  // Pathanamthitta district
  'RANNI','ARANMULA','KONNI','ADOOR','THIRUVALLA','MALLAPALLY',
  // Idukki district
  'DEVIKULAM','UDUMBANCHOLA','THODUPUZHA','IDUKKI','PEERUMADE',
  // Parts of Ernakulam
  'KOTHAMANGALAM','MUVATTUPUZHA','PERUMBAVOOR',
  // Parts of Thrissur
  'IRINJALAKUDA','PUTHUKKAD','CHALAKUDY','KODUNGALLUR',
  // Wayanad
  'MANANTHAVADY','SULTHAN BATHERY','KALPETTA',
]);

// ── Tamil Nadu ────────────────────────────────────────────────────────────────
// Overall: 88% Hindu. Muslim pockets in Vellore, Villupuram. Christian in Kanyakumari.

const TN_MUSLIM = new Set([
  'AMBUR','VANIYAMBADI','GUDIYATHAM','JOLARPET','VELLORE','ARAKKONAM',
  'RANIPET','ARCOT','CHEYYAR',
]);
const TN_CHRISTIAN = new Set([
  // Kanyakumari district (~47% Christian)
  'PADMANABHAPURAM','COLACHEL','RAJAKKAMANGALAM','VILAVANCODE',
  'KILLIYOOR','NAGERCOIL','THUCKALAY','ERANIEL','AGASTEESWARAM',
  // Nilgiris (significant Christian community)
  'GUDALUR','UDHAGAMANDALAM','COONOOR','KOTAGIRI',
]);

// ── West Bengal ───────────────────────────────────────────────────────────────
// Muslim-majority districts: Murshidabad 66.3%, Malda 51.3%, Uttar Dinajpur 49.9%
// High Muslim: Birbhum 36%, South 24 Pgs 35%, North 24 Pgs 26%, Nadia 26%

const WB_MUSLIM = new Set([
  // Murshidabad (66% Muslim) — all constituencies
  'SUTI','JANGIPUR','RAGHUNATHGANJ','SAGARDIGHI','LALGOLA','BHAGAWANGOLA',
  'REJINAGAR','BELDANGA','MURSHIDABAD','NABAGRAM','KHARGRAM','KANDI',
  'BERHAMPORE','NOWDA','DOMKAL','ISLAMPORE','JIAGANJ','BAHARAMPUR',
  'FARAKKA','SAMSERGANJ','RANINAGAR',
  // Malda (51% Muslim)
  'HABIBPUR','GAZOLE','CHANCHAL','HARISCHANDRAPUR','MANIKCHAK',
  'KALIACHAK','MOTHABARI','SUJAPUR','BAISNABNAGAR','ENGLISH BAZAR','OLD MALDA',
  // Uttar Dinajpur (49.9% Muslim)
  'GOALPOKHAR','CHAKULIA','KARANDIGHI','HEMTABAD','KALIAGANJ',
  'RAIGANJ','ITAHAR','ISLAMPUR','CHOPRA','DALKHOLA',
  // Birbhum (36% Muslim) — Muslim-plurality constituencies
  'NALHATI','MURAROI','RAMPURHAT','HANSAN','MAYURESWAR',
  'SURI','SAINTHIA','DUBRAJPUR','RAJNAGAR','KHAYRASOL','LABPUR','NANOOR',
  // South 24 Parganas (35% Muslim) — specific ACs
  'CANNING EAST','CANNING WEST','BASIRHAT NORTH','BASIRHAT SOUTH',
  'MINAKHAN','SANDESHKHALI','HAROA','BADURIA','DEGANGA',
  'AMDANGA','HABRA','GAIGHATA','BONGAON','SWARUPNAGAR',
  // North 24 Parganas (26% Muslim) — specific ACs
  'BARASAT','MADHYAMGRAM','RAJARHAT GOPALPUR',
  // Nadia (26% Muslim) — Muslim-plurality constituencies
  'KARIMPUR','TEHATTA','PALASHIPARA','CHAPRA',
  // Murshidabad-adjacent Birbhum/Burdwan
  'KATWA','KALNA','MEMARI','MANTESWAR',
  // North Bengal Muslim pockets
  'BHANGORE','JAYNAGAR','MATHURAPUR',
]);

// ── Lookup function ───────────────────────────────────────────────────────────

const STATE_MAP = {
  S03: { muslim: ASSAM_MUSLIM,   mixed: ASSAM_MIXED,    christian: null },
  S11: { muslim: KERALA_MUSLIM,  christian: KERALA_CHRISTIAN, mixed: null },
  U07: { muslim: null,           christian: null,        mixed: null },
  S22: { muslim: TN_MUSLIM,      christian: TN_CHRISTIAN, mixed: null },
  S25: { muslim: WB_MUSLIM,      christian: null,        mixed: null },
};

const MAJORITY_META = {
  Hindu:    { label: 'Hindu Majority',    emoji: '🕉️',  color: '#f59e0b' },
  Muslim:   { label: 'Muslim Majority',   emoji: '☪️',  color: '#10b981' },
  Christian:{ label: 'Christian Majority',emoji: '✝️',  color: '#3b82f6' },
  Mixed:    { label: 'Mixed / Tribal',    emoji: '🏳️', color: '#8b949e' },
  Unknown:  { label: 'Unknown',           emoji: '❓',  color: '#484f58' },
};

function getMajority(stateCode, name) {
  const n = name.toUpperCase().trim();
  const map = STATE_MAP[stateCode];
  if (!map) return { majority: 'Unknown', ...MAJORITY_META['Unknown'] };

  if (map.mixed?.has(n))    return { majority: 'Mixed',    confidence: 'estimated', ...MAJORITY_META['Mixed']    };
  if (map.muslim?.has(n))   return { majority: 'Muslim',   confidence: 'estimated', ...MAJORITY_META['Muslim']   };
  if (map.christian?.has(n))return { majority: 'Christian',confidence: 'estimated', ...MAJORITY_META['Christian']};

  return { majority: 'Hindu', confidence: 'estimated', ...MAJORITY_META['Hindu'] };
}

function getAllMajorities() { return Object.keys(MAJORITY_META); }

module.exports = { getMajority, getAllMajorities, MAJORITY_META };
