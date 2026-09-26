import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'

export interface Country {
  code: CountryCode // ISO 3166 code, e.g. "US"
  name: string // e.g. "United States"
  dialCode: string // e.g. "1"
}

// Every country libphonenumber knows, named by the browser's built-in region names.
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({ code, name: regionNames.of(code) ?? code, dialCode: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const DEFAULT_COUNTRY: CountryCode = 'US'
