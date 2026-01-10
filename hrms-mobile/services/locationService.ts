// Location service using country-state-city npm package for mobile app
import { Country, State, City } from 'country-state-city';

export interface CountryOption {
  value: string;
  label: string;
}

export interface StateOption {
  value: string;
  label: string;
}

export interface CityOption {
  value: string;
  label: string;
}

// Popular countries for better UX
const POPULAR_COUNTRIES = [
  'US', 'IN', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'CN', 'BR'
];

/**
 * Get all countries as dropdown options
 */
export const getCountryOptions = async (): Promise<CountryOption[]> => {
  try {
    const countries = Country.getAllCountries();
    const popular: CountryOption[] = [];
    const others: CountryOption[] = [];

    countries.forEach(country => {
      const option = {
        value: country.isoCode,
        label: country.name
      };

      if (POPULAR_COUNTRIES.includes(country.isoCode)) {
        popular.push(option);
      } else {
        others.push(option);
      }
    });

    // Sort popular by the order in POPULAR_COUNTRIES array
    popular.sort((a, b) => {
      const indexA = POPULAR_COUNTRIES.indexOf(a.value);
      const indexB = POPULAR_COUNTRIES.indexOf(b.value);
      return indexA - indexB;
    });

    // Sort others alphabetically
    others.sort((a, b) => a.label.localeCompare(b.label));

    return [...popular, ...others];
  } catch (error) {
    console.error('Error loading countries:', error);
    return [];
  }
};

/**
 * Get states for a specific country as dropdown options
 */
export const getStateOptions = async (countryCode: string): Promise<StateOption[]> => {
  try {
    const states = State.getStatesOfCountry(countryCode);

    if (!states || states.length === 0) {
      return [];
    }

    return states.map(state => ({
      value: state.isoCode,
      label: state.name
    }));
  } catch (error) {
    console.error('Error loading states:', error);
    return [];
  }
};

/**
 * Get cities for a specific state as dropdown options
 */
export const getCityOptions = async (countryCode: string, stateCode: string): Promise<CityOption[]> => {
  try {
    const cities = City.getCitiesOfState(countryCode, stateCode);

    if (!cities || cities.length === 0) {
      return [];
    }

    // Limit to prevent performance issues and sort alphabetically
    return cities
      .slice(0, 200)
      .map(city => ({
        value: city.name,
        label: city.name
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch (error) {
    console.error('Error loading cities:', error);
    return [];
  }
};

/**
 * Get country name by code
 */
export const getCountryName = (countryCode: string): string => {
  const country = Country.getCountryByCode(countryCode);
  return country ? country.name : '';
};

/**
 * Get state name by country and state code
 */
export const getStateName = (countryCode: string, stateCode: string): string => {
  const states = State.getStatesOfCountry(countryCode);
  const state = states?.find(s => s.isoCode === stateCode);
  return state ? state.name : '';
};