/**
 * Parse formatted address into individual components
 * Example: "Main Street, New York, NY, USA"
 * Returns: { street, city, state, country, postalCode }
 */
export const parseFormattedAddress = (formattedAddress) => {
  if (!formattedAddress) return {};
  
  // Split by commas and clean up whitespace
  const parts = formattedAddress.split(',').map(part => part.trim()).filter(Boolean);
  
  if (parts.length === 0) return {};
  
  // Handle different address formats
  let street = '';
  let city = '';
  let state = '';
  let country = '';
  let postalCode = '';
  
  // Format: "Street, City, State, Country"
  if (parts.length >= 4) {
    street = parts[0];
    city = parts[1];
    state = parts[2];
    country = parts[3];
  } else if (parts.length === 3) {
    // Format: "City, State, Country"
    city = parts[0];
    state = parts[1];
    country = parts[2];
  } else if (parts.length === 2) {
    // Format: "State, Country"
    state = parts[0];
    country = parts[1];
  } else if (parts.length === 1) {
    // Single part - could be city, state, or country
    if (parts[0].match(/^\d{6}$/)) {
      postalCode = parts[0];
    } else {
      city = parts[0];
    }
  }
  
  return {
    street,
    city,
    state,
    country,
    postalCode
  };
};

/**
 * Validate location data
 */
export const validateLocationData = (locationData) => {
  const errors = [];
  
  if (locationData.latitude !== undefined && (locationData.latitude < -90 || locationData.latitude > 90)) {
    errors.push('Latitude must be between -90 and 90');
  }
  
  if (locationData.longitude !== undefined && (locationData.longitude < -180 || locationData.longitude > 180)) {
    errors.push('Longitude must be between -180 and 180');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format location components back to a readable string
 */
export const formatLocationString = (components) => {
  const parts = [];
  
  if (components.street) parts.push(components.street);
  if (components.city) parts.push(components.city);
  if (components.state) {
    if (components.postalCode) {
      parts.push(`${components.state} ${components.postalCode}`);
    } else {
      parts.push(components.state);
    }
  }
  if (components.country) parts.push(components.country);
  
  return parts.join(', ');
};
