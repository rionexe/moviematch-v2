const UNRATED = new Set(["", "none", "not rated", "nr", "unrated", "ur"]);

const RATING_TABLE: Record<string, number> = {
  "g": 6,
  "pg": 10,
  "pg-13": 13,
  "r": 17,
  "nc-17": 18,
  "tv-y": 2,
  "tv-y7": 7,
  "tv-g": 6,
  "tv-pg": 10,
  "tv-14": 14,
  "tv-ma": 17,
};

export function mapRatingToAge(rating: string | undefined): number | null {
  if (!rating) return null;

  const normalized = rating
    .toLowerCase()
    .replace(/^rated\s+/, "")
    .replace(/^[a-z]{2}\//, "");

  if (UNRATED.has(normalized)) return null;

  if (RATING_TABLE[normalized] !== undefined) {
    return RATING_TABLE[normalized];
  }

  const numeric = parseFloat(normalized.replace(/\+$/, ""));
  if (!isNaN(numeric)) return numeric;

  return null;
}
