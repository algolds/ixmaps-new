/**
 * Country data types for the map labeling system
 */

/**
 * Individual country data structure
 */
export interface CountryData {
    id: string;
    name: string;
    centerpoint: {
      x: number;
      y: number;
    };
  }
  
  /**
   * Complete countries collection
   */
  export interface CountriesData {
    countries: CountryData[];
  }
  
  /**
   * Label class options for country labels
   */
  export type CountryLabelClass = 'standard' | 'major' | 'minor' | 'capital';
  
  /**
   * Country label configuration
   */
  export interface CountryLabelConfig {
    fontSize: {
      standard: number;
      major: number;
      minor: number;
      capital: number;
    };
    color: {
      standard: string;
      major: string;
      minor: string;
      capital: string;
    };
    zoomThresholds: {
      showMinor: number;
      showAll: number;
    };
  }
  
  /**
   * Default country label configuration
   */
  export const defaultLabelConfig: CountryLabelConfig = {
    fontSize: {
      standard: 12,
      major: 14,
      minor: 10,
      capital: 13
    },
    color: {
      standard: '#333',
      major: '#222',
      minor: '#555',
      capital: '#B22222'
    },
    zoomThresholds: {
      showMinor: 1,
      showAll: 2
    }
  };