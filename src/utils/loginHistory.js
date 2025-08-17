import { LoginHistory } from '../models/index.js';
import axios from 'axios';

/**
 * Utility function to create login history record
 * @param {Object} params - Parameters for creating login history
 * @param {string} params.userId - User ID
 * @param {string} params.sessionId - Session ID (JWT token)
 * @param {Object} params.deviceInfo - Device information from frontend
 * @param {Object} params.request - Express request object for IP and user agent
 * @param {Object} params.locationInfo - Optional location info from frontend
 * @returns {Promise<Object>} Created login history record
 */
export const createLoginHistory = async ({ userId, sessionId, deviceInfo, request, locationInfo }) => {
  try {
    // Extract IP address from request
    const ipAddress = getClientIP(request);
    
    // Parse user agent for device/browser info
    const userAgent = request.headers['user-agent'] || '';
    const { deviceType, deviceName, browser, os } = parseUserAgent(userAgent, deviceInfo);
    
    // Get location info - try IP geolocation first, then use frontend location if available
    let location = await getLocationFromIP(ipAddress);
    
    // If IP geolocation failed or returned "Local Network", try to use frontend location
    if (!location || location.formatted === 'Local Network' || location.formatted === 'Location Unknown') {
      if (locationInfo && (locationInfo.city || locationInfo.country)) {
        // Create a more detailed location object from frontend data
        const frontendLocation = {
          country: locationInfo.country || 'Unknown',
          city: locationInfo.city || 'Unknown',
          region: locationInfo.region || locationInfo.state || 'Unknown',
          formatted: `${locationInfo.city || 'Unknown'}, ${locationInfo.region || locationInfo.state || 'Unknown'}, ${locationInfo.country || 'Unknown'}`.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, ''),
          source: locationInfo.source || 'frontend',
          latitude: locationInfo.latitude,
          longitude: locationInfo.longitude
        };
        
        // If we have coordinates, try to get more detailed info
        if (locationInfo.latitude && locationInfo.longitude) {
          try {
            const detailedLocation = await getLocationFromCoordinates(locationInfo.latitude, locationInfo.longitude);
            if (detailedLocation) {
              location = { ...frontendLocation, ...detailedLocation };
            } else {
              location = frontendLocation;
            }
          } catch (error) {
            // Failed to get detailed location from coordinates
          }
        } else {
          location = frontendLocation;
        }
      } else if (locationInfo && locationInfo.source === 'timezone') {
        // Handle timezone-based location
        location = {
          country: locationInfo.country || 'Unknown',
          city: locationInfo.city || 'Unknown',
          region: locationInfo.region || 'Unknown',
          formatted: `${locationInfo.city || 'Unknown'}, ${locationInfo.country || 'Unknown'}`,
          source: 'timezone'
        };
      } else if (locationInfo && locationInfo.source === 'locale') {
        // Handle locale-based location
        location = {
          country: locationInfo.country || 'Unknown',
          city: 'Unknown',
          region: 'Unknown',
          formatted: `${locationInfo.country || 'Unknown'}`,
          source: 'locale'
        };
      }
    }
    
    // Create login history record
    const loginRecord = await LoginHistory.create({
      user_id: userId,
      session_id: sessionId,
      device_type: deviceType,
      device_name: deviceName,
      browser,
      os,
      ip_address: ipAddress,
      location: location?.formatted || 'Unknown Location',
      country: location?.country || 'Unknown',
      city: location?.city || 'Unknown',
      user_agent: userAgent,
      login_at: new Date(),
      last_activity_at: new Date(),
      is_active: true
    });
    
    return loginRecord;
  } catch (error) {
    // Error creating login history
    throw error;
  }
};

/**
 * Get client IP address from request
 * @param {Object} request - Express request object
 * @returns {string} IP address
 */
export const getClientIP = (request) => {
  // Check for forwarded headers (when behind proxy/load balancer)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    return ip;
  }
  
  // Check for real IP header
  const realIP = request.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }
  
  // Check for CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers['cf-connecting-ip'];
  if (cfIP) {
    return cfIP;
  }
  
  // Check for X-Forwarded-For with multiple IPs (take the first public IP)
  const xForwardedFor = request.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    // Find the first public IP
    for (const ip of ips) {
      if (!isPrivateIP(ip)) {
        return ip;
      }
    }
  }
  
  // Fallback to connection remote address
  const fallbackIP = request.connection?.remoteAddress || 
                    request.socket?.remoteAddress || 
                    request.ip || 
                    'unknown';
  
  return fallbackIP;
};

/**
 * Check if an IP address is private/local
 * @param {string} ip - IP address to check
 * @returns {boolean} True if private IP
 */
const isPrivateIP = (ip) => {
  if (!ip || ip === 'unknown' || ip === 'localhost') return true;
  
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
    /^::1$/,                    // IPv6 localhost
    /^fe80:/,                   // IPv6 link-local
  ];
  
  return privateRanges.some(range => range.test(ip));
};

/**
 * Parse user agent string and device info
 * @param {string} userAgent - User agent string
 * @param {Object} deviceInfo - Device info from frontend
 * @returns {Object} Parsed device information
 */
const parseUserAgent = (userAgent, deviceInfo) => {
  let deviceType = 'unknown';
  let deviceName = null;
  let browser = null;
  let os = null;
  
  // Use device info from frontend if available
  if (deviceInfo) {
    deviceType = deviceInfo.deviceType || 'unknown';
    deviceName = deviceInfo.deviceName || deviceInfo.deviceId || null;
  }
  
  // Handle React Native/Expo specific user agents
  if (userAgent && (userAgent.includes('okhttp') || userAgent.includes('Expo') || userAgent.includes('ReactNative'))) {
    // For React Native apps, we should rely more on frontend device info
    if (!deviceType || deviceType === 'unknown') {
      deviceType = 'mobile'; // Default for React Native apps
    }
    
    if (!deviceName) {
      deviceName = 'Mobile App';
    }
    
    if (!browser) {
      browser = 'Mobile App';
    }
    
    if (!os) {
      // Try to extract OS from user agent or use frontend info
      if (userAgent.includes('Android')) {
        os = 'Android';
        const androidMatch = userAgent.match(/Android (\d+\.\d+)/);
        if (androidMatch) {
          os = `Android ${androidMatch[1]}`;
        }
      } else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
        os = 'iOS';
        const iosMatch = userAgent.match(/OS (\d+[._]\d+)/);
        if (iosMatch) {
          const version = iosMatch[1].replace('_', '.');
          os = `iOS ${version}`;
        }
      } else {
        os = 'Mobile OS';
      }
    }
    
    // If we still don't have proper device info, make educated guesses for mobile
    if (deviceType === 'unknown') {
      deviceType = 'mobile';
    }
    
    if (!deviceName) {
      deviceName = 'Mobile Device';
    }
    
    if (!browser) {
      browser = 'Mobile App';
    }
    
    if (!os) {
      os = 'Mobile OS';
    }
  } else if (userAgent) {
    // Enhanced browser detection for regular web browsers
    if (userAgent.includes('Chrome')) {
      browser = 'Chrome';
      // Check for Chrome Mobile
      if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
        browser = 'Chrome Mobile';
      }
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
      if (userAgent.includes('Mobile')) {
        browser = 'Firefox Mobile';
      }
    } else if (userAgent.includes('Safari')) {
      browser = 'Safari';
      if (userAgent.includes('Mobile')) {
        browser = 'Safari Mobile';
      }
    } else if (userAgent.includes('Edge')) browser = 'Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';
    else if (userAgent.includes('Expo')) browser = 'Expo Go';
    else if (userAgent.includes('ReactNative')) browser = 'React Native';
    
    // Enhanced OS detection
    if (userAgent.includes('Windows')) {
      os = 'Windows';
      // Extract Windows version
      const windowsMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
      if (windowsMatch) {
        const version = windowsMatch[1];
        if (version === '10.0') os = 'Windows 10';
        else if (version === '6.3') os = 'Windows 8.1';
        else if (version === '6.2') os = 'Windows 8';
        else if (version === '6.1') os = 'Windows 7';
      }
    } else if (userAgent.includes('Mac OS X')) {
      os = 'macOS';
      // Extract macOS version
      const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+)/);
      if (macMatch) {
        const version = macMatch[1].replace('_', '.');
        os = `macOS ${version}`;
      }
    } else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) {
      os = 'Android';
      // Extract Android version
      const androidMatch = userAgent.match(/Android (\d+\.\d+)/);
      if (androidMatch) {
        os = `Android ${androidMatch[1]}`;
      }
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod')) {
      os = 'iOS';
      // Extract iOS version
      const iosMatch = userAgent.match(/OS (\d+[._]\d+)/);
      if (iosMatch) {
        const version = iosMatch[1].replace('_', '.');
        os = `iOS ${version}`;
      }
    }
    
    // Enhanced device type detection
    if (deviceType === 'unknown') {
      if (userAgent.includes('Mobile') || 
          userAgent.includes('Android') || 
          userAgent.includes('iPhone') || 
          userAgent.includes('iPod') ||
          userAgent.includes('Expo') ||
          userAgent.includes('ReactNative')) {
        deviceType = 'mobile';
      } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
        deviceType = 'tablet';
      } else {
        deviceType = 'desktop';
      }
    }
    
    // Set device name if not provided by frontend
    if (!deviceName) {
      if (userAgent.includes('iPhone')) {
        deviceName = 'iPhone';
        // Try to extract iPhone model
        const iphoneMatch = userAgent.match(/iPhone\s*(?:OS\s*\d+[._]\d+)?\s*like\s*Mac\s*OS\s*X/);
        if (iphoneMatch) {
          deviceName = 'iPhone';
        }
      } else if (userAgent.includes('iPad')) {
        deviceName = 'iPad';
      } else if (userAgent.includes('Android')) {
        deviceName = 'Android Device';
        // Try to extract device model
        const androidMatch = userAgent.match(/;\s*([^;]+)\s*Build/);
        if (androidMatch) {
          deviceName = androidMatch[1].trim();
        }
      } else if (userAgent.includes('Expo')) {
        deviceName = 'Expo Go App';
      } else if (userAgent.includes('ReactNative')) {
        deviceName = 'React Native App';
      }
    }
  }
  
  // Fallback for mobile apps if still unknown
  if (deviceType === 'unknown' && deviceInfo?.deviceType === 'mobile') {
    deviceType = 'mobile';
  }
  
  if (!deviceName && deviceType === 'mobile') {
    deviceName = 'Mobile Device';
  }
  
  if (!browser && deviceType === 'mobile') {
    browser = 'Mobile App';
  }
  
  if (!os && deviceType === 'mobile') {
    os = 'Mobile OS';
  }
  
  return { deviceType, deviceName, browser, os };
};

/**
 * Get public IP address by making a request to an external service
 * @returns {Promise<string|null>} Public IP address or null if failed
 */
export const getPublicIP = async () => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    // Failed to get public IP
    return null;
  }
};

/**
 * Get location information using multiple geolocation services
 * @param {string} ipAddress - IP address
 * @returns {Promise<Object|null>} Location information
 */
const getLocationFromIP = async (ipAddress) => {
  try {
    // Check if it's a private/local IP
    if (isPrivateIP(ipAddress)) {
      // Try to get public IP for better location detection
      const publicIP = await getPublicIP();
      if (publicIP && !isPrivateIP(publicIP)) {
        ipAddress = publicIP;
      } else {
        return await getLocationFromAlternativeSources();
      }
    }
    
    // Try multiple geolocation services for better accuracy
    const locationServices = [
      {
        name: 'IP-API',
        url: `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`,
        parser: (data) => {
          if (data.status === 'success') {
            return {
              country: data.country,
              countryCode: data.countryCode,
              region: data.regionName,
              city: data.city,
              zip: data.zip,
              lat: data.lat,
              lon: data.lon,
              timezone: data.timezone,
              isp: data.isp,
              formatted: `${data.city}, ${data.regionName}, ${data.country}`
            };
          }
          return null;
        }
      },
      {
        name: 'IPInfo',
        url: `https://ipinfo.io/${ipAddress}/json`,
        parser: (data) => {
          if (data.country && data.city) {
            return {
              country: data.country,
              countryCode: data.country,
              region: data.region,
              city: data.city,
              zip: data.postal,
              lat: data.loc ? data.loc.split(',')[0] : null,
              lon: data.loc ? data.loc.split(',')[1] : null,
              timezone: data.timezone,
              isp: data.org,
              formatted: `${data.city}, ${data.region}, ${data.country}`
            };
          }
          return null;
        }
      },
      {
        name: 'IPAPI',
        url: `https://ipapi.co/${ipAddress}/json/`,
        parser: (data) => {
          if (data.country_name && data.city) {
            return {
              country: data.country_name,
              countryCode: data.country_code,
              region: data.region,
              city: data.city,
              zip: data.postal,
              lat: data.latitude,
              lon: data.longitude,
              timezone: data.timezone,
              isp: data.org,
              formatted: `${data.city}, ${data.region}, ${data.country_name}`
            };
          }
          return null;
        }
      }
    ];
    
    for (const service of locationServices) {
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        const data = response.data;
        
        const locationData = service.parser(data);
        if (locationData) {
          return locationData;
        }
      } catch (error) {
        continue;
      }
    }
    
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      formatted: 'Location Unknown'
    };
    
  } catch (error) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      formatted: 'Location Unknown'
    };
  }
};

/**
 * Get location information from coordinates using reverse geocoding
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Object|null>} Location information
 */
const getLocationFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/?lat=${latitude}&lon=${longitude}`);
    if (response.data && response.data.status === 'success') {
      return {
        country: response.data.country,
        region: response.data.regionName,
        city: response.data.city,
        timezone: response.data.timezone
      };
    }
    return null;
  } catch (error) {
    // Error getting location from coordinates
    return null;
  }
};

/**
 * Get location from alternative sources when IP geolocation fails
 * @returns {Promise<Object>} Location information
 */
const getLocationFromAlternativeSources = async () => {
  try {
    // Try to get location from browser's geolocation API (if available)
    // This would require frontend to send location data
    
    // For now, return a more informative fallback
    return {
      country: 'Local Network',
      city: 'Local Network',
      region: 'Local Network',
      formatted: 'Local Network (Private IP)',
      note: 'Location detection limited due to private network'
    };
  } catch (error) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      formatted: 'Location Unknown'
    };
  }
};

/**
 * Update last activity for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export const updateSessionActivity = async (sessionId) => {
  try {
    await LoginHistory.update(
      { last_activity_at: new Date() },
      { where: { session_id: sessionId, is_active: true } }
    );
    return true;
  } catch (error) {
    // Error updating session activity
    return false;
  }
};

/**
 * Get current session ID from JWT token
 * @param {string} token - JWT token
 * @returns {string|null} Session ID
 */
export const getSessionIdFromToken = (token) => {
  try {
    // For now, we're using the JWT token itself as the session ID
    // In a more sophisticated implementation, you might extract a session ID from the token payload
    return token;
  } catch (error) {
    // Error extracting session ID from token
    return null;
  }
};

/**
 * Get active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Active sessions
 */
export const getActiveSessions = async (userId) => {
  try {
    return await LoginHistory.findAll({
      where: {
        user_id: userId,
        is_active: true
      },
      order: [['last_activity_at', 'DESC']]
    });
  } catch (error) {
    // Error getting active sessions
    return [];
  }
};

/**
 * Mark session as logged out
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export const logoutSession = async (sessionId) => {
  try {
    await LoginHistory.update(
      { 
        logout_at: new Date(),
        is_active: false,
        last_activity_at: new Date()
      },
      { where: { session_id: sessionId, is_active: true } }
    );
    return true;
  } catch (error) {
    // Error logging out session
    return false;
  }
};
