// FIFA World Cup 2026 - Complete Tournament Data
// Sources: FIFA.com official schedule, final draw Dec 5 2025, UEFA playoffs Mar 2026

// Venue data with timezone offsets (in June with DST)
const VENUES = {
  MEX: { name: "Estadio Azteca",         city: "Mexico City",          country: "MX", flag: "🇲🇽", capacity: 87523, tz: -6 },
  GDL: { name: "Estadio Akron",          city: "Guadalajara",          country: "MX", flag: "🇲🇽", capacity: 49850, tz: -6 },
  MTY: { name: "Estadio BBVA",           city: "Monterrey",            country: "MX", flag: "🇲🇽", capacity: 53500, tz: -6 },
  NYC: { name: "MetLife Stadium",        city: "New York/New Jersey",  country: "US", flag: "🇺🇸", capacity: 82500, tz: -4 },
  LAX: { name: "SoFi Stadium",           city: "Los Angeles",          country: "US", flag: "🇺🇸", capacity: 70240, tz: -7 },
  DAL: { name: "AT&T Stadium",           city: "Dallas",               country: "US", flag: "🇺🇸", capacity: 80000, tz: -5 },
  SFO: { name: "Levi's Stadium",         city: "San Francisco Bay",    country: "US", flag: "🇺🇸", capacity: 68500, tz: -7 },
  MIA: { name: "Hard Rock Stadium",      city: "Miami",                country: "US", flag: "🇺🇸", capacity: 64767, tz: -4 },
  SEA: { name: "Lumen Field",            city: "Seattle",              country: "US", flag: "🇺🇸", capacity: 69000, tz: -7 },
  ATL: { name: "Mercedes-Benz Stadium",  city: "Atlanta",              country: "US", flag: "🇺🇸", capacity: 71000, tz: -4 },
  KCK: { name: "Arrowhead Stadium",      city: "Kansas City",          country: "US", flag: "🇺🇸", capacity: 76416, tz: -5 },
  PHI: { name: "Lincoln Financial Field",city: "Philadelphia",         country: "US", flag: "🇺🇸", capacity: 69796, tz: -4 },
  HOU: { name: "NRG Stadium",            city: "Houston",              country: "US", flag: "🇺🇸", capacity: 72220, tz: -5 },
  BOS: { name: "Gillette Stadium",       city: "Boston",               country: "US", flag: "🇺🇸", capacity: 65878, tz: -4 },
  TOR: { name: "BMO Field",              city: "Toronto",              country: "CA", flag: "🇨🇦", capacity: 45000, tz: -4 },
  VAN: { name: "BC Place",               city: "Vancouver",            country: "CA", flag: "🇨🇦", capacity: 54500, tz: -7 }
};

// Team data (48 tim)
const TEAMS = {
  MEX: { name: "Mexico",                 flag: "🇲🇽", group: "A", conf: "CONCACAF" },
  KOR: { name: "Korea Republic",         flag: "🇰🇷", group: "A", conf: "AFC"      },
  RSA: { name: "South Africa",           flag: "🇿🇦", group: "A", conf: "CAF"      },
  CZE: { name: "Czechia",                flag: "🇨🇿", group: "A", conf: "UEFA"     },
  CAN: { name: "Canada",                 flag: "🇨🇦", group: "B", conf: "CONCACAF" },
  SUI: { name: "Switzerland",            flag: "🇨🇭", group: "B", conf: "UEFA"     },
  QAT: { name: "Qatar",                  flag: "🇶🇦", group: "B", conf: "AFC"      },
  BIH: { name: "Bosnia & Herzegovina",   flag: "🇧🇦", group: "B", conf: "UEFA"     },
  BRA: { name: "Brazil",                 flag: "🇧🇷", group: "C", conf: "CONMEBOL"},
  MAR: { name: "Morocco",                flag: "🇲🇦", group: "C", conf: "CAF"      },
  SCO: { name: "Scotland",               flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", conf: "UEFA"     },
  HAI: { name: "Haiti",                  flag: "🇭🇹", group: "C", conf: "CONCACAF" },
  USA: { name: "United States",          flag: "🇺🇸", group: "D", conf: "CONCACAF" },
  AUS: { name: "Australia",              flag: "🇦🇺", group: "D", conf: "AFC"      },
  PAR: { name: "Paraguay",               flag: "🇵🇾", group: "D", conf: "CONMEBOL"},
  TUR: { name: "Türkiye",                flag: "🇹🇷", group: "D", conf: "UEFA"     },
  GER: { name: "Germany",                flag: "🇩🇪", group: "E", conf: "UEFA"     },
  ECU: { name: "Ecuador",                flag: "🇪🇨", group: "E", conf: "CONMEBOL"},
  CIV: { name: "Côte d'Ivoire",          flag: "🇨🇮", group: "E", conf: "CAF"      },
  CUW: { name: "Curaçao",                flag: "🇨🇼", group: "E", conf: "CONCACAF" },
  NED: { name: "Netherlands",            flag: "🇳🇱", group: "F", conf: "UEFA"     },
  JPN: { name: "Japan",                  flag: "🇯🇵", group: "F", conf: "AFC"      },
  TUN: { name: "Tunisia",                flag: "🇹🇳", group: "F", conf: "CAF"      },
  SWE: { name: "Sweden",                 flag: "🇸🇪", group: "F", conf: "UEFA"     },
  BEL: { name: "Belgium",                flag: "🇧🇪", group: "G", conf: "UEFA"     },
  IRI: { name: "IR Iran",                flag: "🇮🇷", group: "G", conf: "AFC"      },
  EGY: { name: "Egypt",                  flag: "🇪🇬", group: "G", conf: "CAF"      },
  NZL: { name: "New Zealand",            flag: "🇳🇿", group: "G", conf: "OFC"      },
  ESP: { name: "Spain",                  flag: "🇪🇸", group: "H", conf: "UEFA"     },
  URU: { name: "Uruguay",                flag: "🇺🇾", group: "H", conf: "CONMEBOL"},
  KSA: { name: "Saudi Arabia",           flag: "🇸🇦", group: "H", conf: "AFC"      },
  CPV: { name: "Cape Verde",             flag: "🇨🇻", group: "H", conf: "CAF"      },
  FRA: { name: "France",                 flag: "🇫🇷", group: "I", conf: "UEFA"     },
  SEN: { name: "Senegal",                flag: "🇸🇳", group: "I", conf: "CAF"      },
  NOR: { name: "Norway",                 flag: "🇳🇴", group: "I", conf: "UEFA"     },
  P02: { name: "FIFA Play-off 2",        flag: "🌍", group: "I", conf: "TBD"      },
  ARG: { name: "Argentina",              flag: "🇦🇷", group: "J", conf: "CONMEBOL"},
  AUT: { name: "Austria",                flag: "🇦🇹", group: "J", conf: "UEFA"     },
  ALG: { name: "Algeria",                flag: "🇩🇿", group: "J", conf: "CAF"      },
  JOR: { name: "Jordan",                 flag: "🇯🇴", group: "J", conf: "AFC"      },
  POR: { name: "Portugal",               flag: "🇵🇹", group: "K", conf: "UEFA"     },
  COL: { name: "Colombia",               flag: "🇨🇴", group: "K", conf: "CONMEBOL"},
  UZB: { name: "Uzbekistan",             flag: "🇺🇿", group: "K", conf: "AFC"      },
  P01: { name: "FIFA Play-off 1",        flag: "🌍", group: "K", conf: "TBD"      },
  ENG: { name: "England",                flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", conf: "UEFA"     },
  CRO: { name: "Croatia",                flag: "🇭🇷", group: "L", conf: "UEFA"     },
  PAN: { name: "Panama",                 flag: "🇵🇦", group: "L", conf: "CONCACAF" },
  GHA: { name: "Ghana",                  flag: "🇬🇭", group: "L", conf: "CAF"      }
};

// Helper: convert local time at venue to WIB (UTC+7)
// tz = UTC offset. To go to WIB: add (7 - tz) hours
function toWIB(tzOffset) {
  return 7 - tzOffset; // hours to add
}

// =============================================================================
// MATCHES - All 104 fixtures
// Format: { id, date "YYYY-MM-DD", time "HH:MM" (local at venue), venue code, group, md (matchday), home, away, stage }
// stage: "group" | "r32" | "r16" | "qf" | "sf" | "3rd" | "final"
// For knockout matches: home/away determined by bracket position (placeholder "W" for winners, "RU" for runners-up)
// =============================================================================

const MATCHES = [
  // ============== GROUP STAGE - 72 MATCHES ==============

  // --- MD1: June 11-18, 2026 ---
  { id: 1,  date: "2026-06-11", time: "15:00", venue: "MEX", group: "A", md: 1, home: "MEX", away: "RSA", stage: "group" }, // Opening
  { id: 2,  date: "2026-06-11", time: "21:00", venue: "GDL", group: "A", md: 1, home: "KOR", away: "CZE", stage: "group" },
  { id: 3,  date: "2026-06-12", time: "15:00", venue: "TOR", group: "B", md: 1, home: "CAN", away: "BIH", stage: "group" },
  { id: 4,  date: "2026-06-12", time: "18:00", venue: "SFO", group: "B", md: 1, home: "QAT", away: "SUI", stage: "group" },
  { id: 5,  date: "2026-06-12", time: "18:00", venue: "NYC", group: "C", md: 1, home: "BRA", away: "MAR", stage: "group" },
  { id: 6,  date: "2026-06-13", time: "15:00", venue: "BOS", group: "C", md: 1, home: "HAI", away: "SCO", stage: "group" },
  { id: 7,  date: "2026-06-12", time: "21:00", venue: "LAX", group: "D", md: 1, home: "USA", away: "PAR", stage: "group" },
  { id: 8,  date: "2026-06-13", time: "13:00", venue: "VAN", group: "D", md: 1, home: "AUS", away: "TUR", stage: "group" },
  { id: 9,  date: "2026-06-13", time: "13:00", venue: "HOU", group: "E", md: 1, home: "GER", away: "CUW", stage: "group" },
  { id: 10, date: "2026-06-13", time: "16:00", venue: "DAL", group: "F", md: 1, home: "NED", away: "JPN", stage: "group" },
  { id: 11, date: "2026-06-13", time: "19:00", venue: "PHI", group: "E", md: 1, home: "CIV", away: "ECU", stage: "group" },
  { id: 12, date: "2026-06-14", time: "12:00", venue: "ATL", group: "H", md: 1, home: "ESP", away: "CPV", stage: "group" },
  { id: 13, date: "2026-06-14", time: "15:00", venue: "SEA", group: "G", md: 1, home: "BEL", away: "EGY", stage: "group" },
  { id: 14, date: "2026-06-14", time: "18:00", venue: "MIA", group: "H", md: 1, home: "KSA", away: "URU", stage: "group" },
  { id: 15, date: "2026-06-14", time: "15:00", venue: "NYC", group: "I", md: 1, home: "FRA", away: "SEN", stage: "group" },
  { id: 16, date: "2026-06-14", time: "21:00", venue: "LAX", group: "G", md: 1, home: "IRI", away: "NZL", stage: "group" },
  { id: 17, date: "2026-06-15", time: "12:00", venue: "SFO", group: "J", md: 1, home: "AUT", away: "JOR", stage: "group" },
  { id: 18, date: "2026-06-15", time: "16:00", venue: "DAL", group: "L", md: 1, home: "ENG", away: "CRO", stage: "group" },
  { id: 19, date: "2026-06-15", time: "19:00", venue: "TOR", group: "L", md: 1, home: "GHA", away: "PAN", stage: "group" },
  { id: 20, date: "2026-06-15", time: "21:00", venue: "KCK", group: "J", md: 1, home: "ARG", away: "ALG", stage: "group" },
  { id: 21, date: "2026-06-16", time: "22:00", venue: "MEX", group: "K", md: 1, home: "UZB", away: "COL", stage: "group" },
  { id: 22, date: "2026-06-16", time: "13:00", venue: "HOU", group: "K", md: 1, home: "POR", away: "P01", stage: "group" },
  { id: 23, date: "2026-06-16", time: "20:00", venue: "NYC", group: "I", md: 1, home: "NOR", away: "P02", stage: "group" },
  { id: 24, date: "2026-06-16", time: "16:00", venue: "MTY", group: "F", md: 1, home: "TUN", away: "SWE", stage: "group" },

  // --- MD2: June 18-23, 2026 ---
  { id: 25, date: "2026-06-18", time: "15:00", venue: "VAN", group: "B", md: 2, home: "CAN", away: "QAT", stage: "group" },
  { id: 26, date: "2026-06-18", time: "18:00", venue: "ATL", group: "A", md: 2, home: "CZE", away: "RSA", stage: "group" },
  { id: 27, date: "2026-06-19", time: "15:00", venue: "SEA", group: "D", md: 2, home: "USA", away: "AUS", stage: "group" },
  { id: 28, date: "2026-06-19", time: "18:00", venue: "BOS", group: "C", md: 2, home: "SCO", away: "MAR", stage: "group" },
  { id: 29, date: "2026-06-19", time: "21:00", venue: "GDL", group: "A", md: 2, home: "MEX", away: "KOR", stage: "group" },
  { id: 30, date: "2026-06-20", time: "16:00", venue: "TOR", group: "E", md: 2, home: "GER", away: "CIV", stage: "group" },
  { id: 31, date: "2026-06-20", time: "21:00", venue: "PHI", group: "C", md: 2, home: "BRA", away: "HAI", stage: "group" },
  { id: 32, date: "2026-06-21", time: "00:00", venue: "MTY", group: "F", md: 2, home: "TUN", away: "JPN", stage: "group" },
  { id: 33, date: "2026-06-21", time: "12:00", venue: "ATL", group: "H", md: 2, home: "ESP", away: "KSA", stage: "group" },
  { id: 34, date: "2026-06-21", time: "15:00", venue: "LAX", group: "G", md: 2, home: "BEL", away: "IRI", stage: "group" },
  { id: 35, date: "2026-06-21", time: "18:00", venue: "MIA", group: "H", md: 2, home: "URU", away: "CPV", stage: "group" },
  { id: 36, date: "2026-06-21", time: "20:00", venue: "KCK", group: "E", md: 2, home: "ECU", away: "CUW", stage: "group" },
  { id: 37, date: "2026-06-22", time: "13:00", venue: "DAL", group: "J", md: 2, home: "ARG", away: "AUT", stage: "group" },
  { id: 38, date: "2026-06-22", time: "21:00", venue: "VAN", group: "G", md: 2, home: "NZL", away: "EGY", stage: "group" },
  { id: 39, date: "2026-06-23", time: "13:00", venue: "HOU", group: "K", md: 2, home: "POR", away: "UZB", stage: "group" },
  { id: 40, date: "2026-06-23", time: "16:00", venue: "BOS", group: "L", md: 2, home: "ENG", away: "GHA", stage: "group" },
  { id: 41, date: "2026-06-23", time: "19:00", venue: "TOR", group: "L", md: 2, home: "PAN", away: "CRO", stage: "group" },
  { id: 42, date: "2026-06-23", time: "20:00", venue: "NYC", group: "I", md: 2, home: "NOR", away: "SEN", stage: "group" },
  { id: 43, date: "2026-06-23", time: "23:00", venue: "SFO", group: "J", md: 2, home: "JOR", away: "ALG", stage: "group" },
  { id: 44, date: "2026-06-23", time: "19:00", venue: "MEX", group: "B", md: 2, home: "SUI", away: "BIH", stage: "group" },
  { id: 45, date: "2026-06-23", time: "20:00", venue: "PHI", group: "D", md: 2, home: "PAR", away: "TUR", stage: "group" },
  { id: 46, date: "2026-06-23", time: "20:00", venue: "DAL", group: "F", md: 2, home: "SWE", away: "JPN", stage: "group" },
  { id: 47, date: "2026-06-23", time: "20:00", venue: "MIA", group: "I", md: 2, home: "FRA", away: "P02", stage: "group" },
  { id: 48, date: "2026-06-23", time: "20:00", venue: "MTY", group: "K", md: 2, home: "COL", away: "P01", stage: "group" },

  // --- MD3: June 24-28, 2026 ---
  { id: 49, date: "2026-06-24", time: "15:00", venue: "VAN", group: "B", md: 3, home: "SUI", away: "CAN", stage: "group" },
  { id: 50, date: "2026-06-24", time: "18:00", venue: "MIA", group: "C", md: 3, home: "SCO", away: "BRA", stage: "group" },
  { id: 51, date: "2026-06-24", time: "18:00", venue: "ATL", group: "C", md: 3, home: "MAR", away: "HAI", stage: "group" },
  { id: 52, date: "2026-06-24", time: "20:00", venue: "BOS", group: "B", md: 3, home: "BIH", away: "QAT", stage: "group" },
  { id: 53, date: "2026-06-25", time: "16:00", venue: "PHI", group: "E", md: 3, home: "CUW", away: "CIV", stage: "group" },
  { id: 54, date: "2026-06-25", time: "16:00", venue: "NYC", group: "E", md: 3, home: "ECU", away: "GER", stage: "group" },
  { id: 55, date: "2026-06-25", time: "19:00", venue: "KCK", group: "F", md: 3, home: "TUN", away: "NED", stage: "group" },
  { id: 56, date: "2026-06-25", time: "21:00", venue: "MTY", group: "A", md: 3, home: "RSA", away: "KOR", stage: "group" },
  { id: 57, date: "2026-06-25", time: "21:00", venue: "MEX", group: "A", md: 3, home: "CZE", away: "MEX", stage: "group" },
  { id: 58, date: "2026-06-26", time: "15:00", venue: "BOS", group: "I", md: 3, home: "NOR", away: "FRA", stage: "group" },
  { id: 59, date: "2026-06-26", time: "15:00", venue: "MIA", group: "I", md: 3, home: "P02", away: "SEN", stage: "group" },
  { id: 60, date: "2026-06-26", time: "22:00", venue: "SFO", group: "D", md: 3, home: "PAR", away: "AUS", stage: "group" },
  { id: 61, date: "2026-06-26", time: "22:00", venue: "SEA", group: "D", md: 3, home: "TUR", away: "USA", stage: "group" },
  { id: 62, date: "2026-06-27", time: "17:00", venue: "PHI", group: "L", md: 3, home: "CRO", away: "GHA", stage: "group" },
  { id: 63, date: "2026-06-27", time: "17:00", venue: "NYC", group: "L", md: 3, home: "PAN", away: "ENG", stage: "group" },
  { id: 64, date: "2026-06-27", time: "19:30", venue: "MIA", group: "K", md: 3, home: "COL", away: "POR", stage: "group" },
  { id: 65, date: "2026-06-27", time: "19:30", venue: "HOU", group: "K", md: 3, home: "P01", away: "UZB", stage: "group" },
  { id: 66, date: "2026-06-27", time: "20:00", venue: "GDL", group: "H", md: 3, home: "URU", away: "ESP", stage: "group" },
  { id: 67, date: "2026-06-27", time: "20:00", venue: "ATL", group: "H", md: 3, home: "CPV", away: "KSA", stage: "group" },
  { id: 68, date: "2026-06-27", time: "23:00", venue: "VAN", group: "G", md: 3, home: "NZL", away: "BEL", stage: "group" },
  { id: 69, date: "2026-06-27", time: "23:00", venue: "SEA", group: "G", md: 3, home: "EGY", away: "IRI", stage: "group" },
  { id: 70, date: "2026-06-27", time: "22:00", venue: "LAX", group: "J", md: 3, home: "ALG", away: "AUT", stage: "group" },
  { id: 71, date: "2026-06-27", time: "22:00", venue: "DAL", group: "J", md: 3, home: "JOR", away: "ARG", stage: "group" },
  { id: 72, date: "2026-06-27", time: "20:00", venue: "LAX", group: "F", md: 3, home: "SWE", away: "NED", stage: "group" },

  // ============== ROUND OF 32 - 16 MATCHES (June 28 - July 3) ==============
  // Bracket: top 2 from each group (A-L) + 8 best 3rd → 32 teams → 16 matches
  // Bracket (simplified): 1A vs 3rd, 1C vs 2D, 1E vs 3rd, 1G vs 2H, 1I vs 3rd, 1K vs 2L, 1B vs 3rd, 1D vs 2C, 1F vs 3rd, 1H vs 2G, 1J vs 3rd, 1L vs 2K, 2A vs 2C, 2E vs 2D, 2B vs 2F, 2J vs 2H
  { id: 73, date: "2026-06-28", time: "16:00", venue: "LAX", group: null, md: null, home: "1A", away: "3CDE", stage: "r32" },
  { id: 74, date: "2026-06-28", time: "20:00", venue: "PHI", group: null, md: null, home: "1C", away: "2D", stage: "r32" },
  { id: 75, date: "2026-06-29", time: "16:00", venue: "DAL", group: null, md: null, home: "1E", away: "3AB", stage: "r32" },
  { id: 76, date: "2026-06-29", time: "20:00", venue: "MIA", group: null, md: null, home: "1G", away: "2H", stage: "r32" },
  { id: 77, date: "2026-06-30", time: "16:00", venue: "NYC", group: null, md: null, home: "1I", away: "3FGH", stage: "r32" },
  { id: 78, date: "2026-06-30", time: "20:00", venue: "KCK", group: null, md: null, home: "1K", away: "2L", stage: "r32" },
  { id: 79, date: "2026-07-01", time: "16:00", venue: "HOU", group: null, md: null, home: "1B", away: "3EF", stage: "r32" },
  { id: 80, date: "2026-07-01", time: "20:00", venue: "BOS", group: null, md: null, home: "1D", away: "2C", stage: "r32" },
  { id: 81, date: "2026-07-02", time: "16:00", venue: "ATL", group: null, md: null, home: "1F", away: "3IJ", stage: "r32" },
  { id: 82, date: "2026-07-02", time: "20:00", venue: "SEA", group: null, md: null, home: "1H", away: "2G", stage: "r32" },
  { id: 83, date: "2026-07-03", time: "16:00", venue: "MTY", group: null, md: null, home: "1J", away: "3KL", stage: "r32" },
  { id: 84, date: "2026-07-03", time: "20:00", venue: "TOR", group: null, md: null, home: "1L", away: "2K", stage: "r32" },
  { id: 85, date: "2026-07-03", time: "20:00", venue: "SFO", group: null, md: null, home: "2A", away: "2B", stage: "r32" },
  { id: 86, date: "2026-07-03", time: "20:00", venue: "MEX", group: null, md: null, home: "2E", away: "2D", stage: "r32" },
  { id: 87, date: "2026-07-03", time: "20:00", venue: "GDL", group: null, md: null, home: "2B", away: "2F", stage: "r32" },
  { id: 88, date: "2026-07-03", time: "20:00", venue: "VAN", group: null, md: null, home: "2J", away: "2H", stage: "r32" },

  // ============== ROUND OF 16 - 8 MATCHES (July 4-7) ==============
  { id: 89, date: "2026-07-04", time: "17:00", venue: "HOU", group: null, md: null, home: "W73", away: "W75", stage: "r16" },
  { id: 90, date: "2026-07-04", time: "21:00", venue: "PHI", group: null, md: null, home: "W74", away: "W77", stage: "r16" },
  { id: 91, date: "2026-07-05", time: "20:00", venue: "NYC", group: null, md: null, home: "W76", away: "W78", stage: "r16" },
  { id: 92, date: "2026-07-06", time: "00:00", venue: "MEX", group: null, md: null, home: "W79", away: "W80", stage: "r16" },
  { id: 93, date: "2026-07-06", time: "19:00", venue: "DAL", group: null, md: null, home: "W83", away: "W84", stage: "r16" },
  { id: 94, date: "2026-07-07", time: "00:00", venue: "SEA", group: null, md: null, home: "W81", away: "W82", stage: "r16" },
  { id: 95, date: "2026-07-07", time: "16:00", venue: "ATL", group: null, md: null, home: "W86", away: "W88", stage: "r16" },
  { id: 96, date: "2026-07-07", time: "20:00", venue: "VAN", group: null, md: null, home: "W85", away: "W87", stage: "r16" },

  // ============== QUARTER-FINALS - 4 MATCHES (July 9-12) ==============
  { id: 97, date: "2026-07-09", time: "20:00", venue: "BOS", group: null, md: null, home: "W89", away: "W90", stage: "qf" },
  { id: 98, date: "2026-07-10", time: "19:00", venue: "LAX", group: null, md: null, home: "W93", away: "W94", stage: "qf" },
  { id: 99, date: "2026-07-11", time: "21:00", venue: "MIA", group: null, md: null, home: "W91", away: "W92", stage: "qf" },
  { id: 100, date: "2026-07-12", time: "01:00", venue: "KCK", group: null, md: null, home: "W95", away: "W96", stage: "qf" },

  // ============== SEMI-FINALS - 2 MATCHES ==============
  { id: 101, date: "2026-07-14", time: "19:00", venue: "DAL", group: null, md: null, home: "W97", away: "W98", stage: "sf" },
  { id: 102, date: "2026-07-15", time: "19:00", venue: "ATL", group: null, md: null, home: "W99", away: "W100", stage: "sf" },

  // ============== THIRD PLACE Play-off ==============
  { id: 103, date: "2026-07-18", time: "18:00", venue: "MIA", group: null, md: null, home: "L101", away: "L102", stage: "3rd" },

  // ============== FINAL ==============
  { id: 104, date: "2026-07-19", time: "15:00", venue: "NYC", group: null, md: null, home: "W101", away: "W102", stage: "final" }
];

// =============================================================================
// UI helpers
// =============================================================================

const STAGE_LABELS = {
  group: "Group Stage",
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  "3rd": "3rd Place",
  final: "FINAL"
};

const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "3rd", "final"];

// Compute WIB time from local time + venue TZ
function toWIBTime(dateStr, localTime, venueCode) {
  const tz = VENUES[venueCode].tz;
  const offsetH = 7 - tz; // hours to add to get WIB
  const [hh, mm] = localTime.split(":").map(Number);
  // Date might cross midnight
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, hh, mm) - tz * 3600 * 1000;
  const wib = new Date(utc + 7 * 3600 * 1000);
  const wihH = String(wib.getUTCHours()).padStart(2, "0");
  const wihM = String(wib.getUTCMinutes()).padStart(2, "0");
  // Determine if date shifted
  const dayShift = wib.getUTCDate() !== d || wib.getUTCMonth() !== (m - 1) || wib.getUTCFullYear() !== y;
  return { time: `${wihH}:${wihM}`, dayShift };
}

// Format date in Indonesian style
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
function formatDateID(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { day: d, month: MONTHS_ID[m - 1], weekday: DAYS_ID[dt.getUTCDay()] };
}

// =============================================================================
// HELPERS
// =============================================================================

// Today / tomorrow (in YYYY-MM-DD, computed in WIB/UTC+7)
function todayInWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}
function tomorrowInWIB() {
  return new Date(Date.now() + 24 * 3600 * 1000 + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

// Convert match to WIB datetime
function matchToWIB(m) {
  const tz = VENUES[m.venue].tz;
  const [y, mo, d] = m.date.split("-").map(Number);
  const [hh, mm] = m.time.split(":").map(Number);
  const utc = Date.UTC(y, mo - 1, d, hh, mm) - tz * 3600 * 1000;
  return new Date(utc + 7 * 3600 * 1000);
}

// Get next match (in future, group stage only for now)
function getNextMatch() {
  const now = new Date();
  const future = MATCHES
    .filter(m => m.stage === 'group' && matchToWIB(m) > now)
    .sort((a, b) => matchToWIB(a) - matchToWIB(b));
  return future[0] || null;
}

// Get matches for date string (WIB date)
function getMatchesOnDate(dateStr) {
  return MATCHES.filter(m => m.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
}

// Search teams by query
function searchTeams(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return Object.entries(TEAMS)
    .filter(([code, t]) =>
      t.name.toLowerCase().includes(q) ||
      code.toLowerCase().includes(q) ||
      t.conf.toLowerCase().includes(q)
    )
    .map(([code, t]) => ({ code, ...t }));
}

// Featured / marquee matches
const FEATURED_IDS = [1, 5, 7, 10, 15, 20, 30, 104];
function getFeaturedMatches() {
  return FEATURED_IDS.map(id => MATCHES.find(m => m.id === id)).filter(Boolean);
}
