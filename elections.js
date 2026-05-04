// State codes follow ECI's alphabetical numbering (S01=AndhraPradesh … S25=WestBengal).
// Confirmed from May 2026 scraper: S03=Assam, S11=Kerala, U07=Puducherry, S22=TamilNadu, S25=WestBengal.
// All others are best-guess estimates; page counts ≈ ceil(seats/20).

const ELECTIONS = [
  {
    code: 'may2026',
    label: 'May 2026',
    name: 'Assembly Elections — May 2026',
    base: 'https://results.eci.gov.in/ResultAcGenMay2026/',
    states: [
      { code: 'S03', name: 'Assam',       seats: 126, pages: 7,  flag: '🏔️', majority: 64  },
      { code: 'S11', name: 'Kerala',      seats: 140, pages: 7,  flag: '🌴', majority: 71  },
      { code: 'U07', name: 'Puducherry',  seats: 30,  pages: 2,  flag: '🏖️', majority: 16  },
      { code: 'S22', name: 'Tamil Nadu',  seats: 234, pages: 12, flag: '🎭', majority: 118 },
      { code: 'S25', name: 'West Bengal', seats: 294, pages: 15, flag: '🐯', majority: 148 },
    ],
  },
  {
    code: 'nov2024',
    label: 'Nov 2024',
    name: 'Assembly Elections — Nov 2024',
    base: 'https://results.eci.gov.in/ResultAcGenNov2024/',
    states: [
      { code: 'S10', name: 'Jharkhand',   seats: 81,  pages: 5,  flag: '🌿', majority: 41  },
      { code: 'S14', name: 'Maharashtra', seats: 288, pages: 15, flag: '🦁', majority: 145 },
    ],
  },
  {
    code: 'oct2024',
    label: 'Oct 2024',
    name: 'Assembly Elections — Oct 2024',
    base: 'https://results.eci.gov.in/ResultAcGenOct2024/',
    states: [
      { code: 'S08', name: 'Haryana',         seats: 90, pages: 5, flag: '🌾', majority: 46 },
      { code: 'U08', name: 'Jammu & Kashmir', seats: 90, pages: 5, flag: '❄️', majority: 46 },
    ],
  },
  {
    code: 'dec2023',
    label: 'Dec 2023',
    name: 'Assembly Elections — Dec 2023',
    base: 'https://results.eci.gov.in/ResultAcGenDec2023/',
    states: [
      { code: 'S21', name: 'Rajasthan',      seats: 200, pages: 10, flag: '🏜️', majority: 101 },
      { code: 'S13', name: 'Madhya Pradesh', seats: 230, pages: 12, flag: '🐆', majority: 116 },
      { code: 'S05', name: 'Chhattisgarh',  seats: 90,  pages: 5,  flag: '🌲', majority: 46  },
      { code: 'S23', name: 'Telangana',      seats: 119, pages: 6,  flag: '🌶️', majority: 60  },
      { code: 'S17', name: 'Mizoram',        seats: 40,  pages: 2,  flag: '⛰️', majority: 21  },
    ],
  },
  {
    code: 'may2023',
    label: 'May 2023',
    name: 'Assembly Elections — May 2023',
    base: 'https://results.eci.gov.in/ResultAcGenMay2023/',
    states: [
      { code: 'S12', name: 'Karnataka', seats: 224, pages: 12, flag: '🐘', majority: 113 },
    ],
  },
  {
    code: 'feb2023',
    label: 'Feb 2023',
    name: 'Assembly Elections — Feb 2023',
    base: 'https://results.eci.gov.in/ResultAcGenFeb2023/',
    states: [
      { code: 'S24', name: 'Tripura',   seats: 60, pages: 3, flag: '🏕️', majority: 31 },
      { code: 'S16', name: 'Meghalaya', seats: 60, pages: 3, flag: '☁️', majority: 31 },
      { code: 'S18', name: 'Nagaland',  seats: 60, pages: 3, flag: '🗡️', majority: 31 },
    ],
  },
];

module.exports = { ELECTIONS };
