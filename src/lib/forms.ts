export const vendorTypeCodes = [
  'restaurant',
  'mama_lishe',
  'mama_chapati',
  'street_food',
  'small_food_business',
  'catering',
  'other',
] as const

export const categoryCodes = [
  'tanzanian',
  'east_african',
  'swahili',
  'street_food',
  'grills',
  'breakfast',
  'catering',
  'beverages',
  'bakery',
  'other',
] as const

export const regionCodes = [
  'dar_es_salaam',
  'arusha',
  'mwanza',
  'dodoma',
  'mbeya',
  'morogoro',
  'tanga',
  'zanzibar',
  'other',
] as const

export const vehicleTypeCodes = ['motorcycle', 'bicycle', 'car', 'other'] as const

export const ownershipCodes = ['own', 'authorised', 'other'] as const

export function mapOptions(codes: readonly string[], labels: readonly string[]) {
  return codes.map((value, index) => ({ value, label: labels[index] || value }))
}

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function loadDraft<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<T>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

export function saveDraft<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Draft persistence is a convenience only. Storage may be unavailable.
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}
