// Maps full state/province/country names → codes used in the data,
// so users can search "texas" or "ontario" or "united states" naturally.

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

const CA_PROVINCES: Record<string, string> = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
  "newfoundland and labrador": "NL", newfoundland: "NL", "nova scotia": "NS",
  ontario: "ON", "prince edward island": "PE", quebec: "QC", saskatchewan: "SK",
  "northwest territories": "NT", nunavut: "NU", yukon: "YT",
};

const COUNTRIES: Record<string, string> = {
  "united states": "US", usa: "US", america: "US",
  canada: "CA",
  australia: "AU",
  spain: "ES",
  poland: "PL",
  peru: "PE",
  "puerto rico": "PR",
};

const STATE_NAME_BY_CODE: Record<string, string> = {};
for (const [name, code] of Object.entries(US_STATES)) STATE_NAME_BY_CODE[code] = name;
for (const [name, code] of Object.entries(CA_PROVINCES)) STATE_NAME_BY_CODE[code] = name;
const COUNTRY_NAME_BY_CODE: Record<string, string> = {};
for (const [name, code] of Object.entries(COUNTRIES)) {
  if (!COUNTRY_NAME_BY_CODE[code]) COUNTRY_NAME_BY_CODE[code] = name;
}

/** Given a query, return possible state/province codes it could resolve to. */
export function statesMatchingQuery(q: string): string[] {
  const out = new Set<string>();
  for (const [name, code] of Object.entries(US_STATES)) {
    if (name.startsWith(q) || name.includes(q)) out.add(code);
  }
  for (const [name, code] of Object.entries(CA_PROVINCES)) {
    if (name.startsWith(q) || name.includes(q)) out.add(code);
  }
  return Array.from(out);
}

/** Given a query, return possible country codes it could resolve to. */
export function countriesMatchingQuery(q: string): string[] {
  const out = new Set<string>();
  for (const [name, code] of Object.entries(COUNTRIES)) {
    if (name.startsWith(q) || name.includes(q)) out.add(code);
  }
  return Array.from(out);
}

/** Pretty name for a state/province code, falling back to the code. */
export function stateName(code: string): string {
  const name = STATE_NAME_BY_CODE[code.toUpperCase()];
  return name ? name.replace(/\b\w/g, (c) => c.toUpperCase()) : code;
}

/** Pretty name for a country code. */
export function countryName(code: string): string {
  const name = COUNTRY_NAME_BY_CODE[code.toUpperCase()];
  return name ? name.replace(/\b\w/g, (c) => c.toUpperCase()) : code;
}
