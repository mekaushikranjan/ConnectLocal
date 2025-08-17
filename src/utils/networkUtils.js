import os from 'os';

/**
 * Get all network interfaces and their IP addresses
 * Useful for debugging mobile device connectivity
 */
export const getNetworkInterfaces = () => {
  const interfaces = os.networkInterfaces();
  const networkInfo = {};

  Object.keys(interfaces).forEach((name) => {
    interfaces[name].forEach((networkInterface) => {
      // Only include IPv4 addresses that are not internal
      if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
        if (!networkInfo[name]) {
          networkInfo[name] = [];
        }
        networkInfo[name].push({
          address: networkInterface.address,
          netmask: networkInterface.netmask,
          family: networkInterface.family,
          mac: networkInterface.mac
        });
      }
    });
  });

  return networkInfo;
};

/**
 * Get the primary local IP address for the server
 * Useful for mobile device connection
 */
export const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  
  // Priority order for network interfaces
  const priorityInterfaces = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];
  
  for (const interfaceName of priorityInterfaces) {
    if (interfaces[interfaceName]) {
      for (const networkInterface of interfaces[interfaceName]) {
        if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
          return networkInterface.address;
        }
      }
    }
  }
  
  // Fallback: get first non-internal IPv4 address
  for (const interfaceName in interfaces) {
    for (const networkInterface of interfaces[interfaceName]) {
      if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
        return networkInterface.address;
      }
    }
  }
  
  return 'localhost';
};

/**
 * Check if an IP address is in a private network range
 */
export const isPrivateIP = (ip) => {
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^192\.168\./,              // 192.168.0.0/16
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^127\./,                   // 127.0.0.0/8 (localhost)
    /^169\.254\./               // 169.254.0.0/16 (link-local)
  ];
  
  return privateRanges.some(range => range.test(ip));
};

/**
 * Log network information for debugging mobile connectivity
 */
export const logNetworkInfo = (port = process.env.PORT || 5000) => {
  const localIP = getLocalIP();
  const networkInterfaces = getNetworkInterfaces();
  
  // Network information logging removed
};

/**
 * Get client IP address from request
 * Handles various proxy scenarios
 */
export const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

/**
 * Validate if a request origin is from a supported private network
 */
export const isValidPrivateNetworkOrigin = (origin) => {
  if (!origin) return false;
  
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    
    // Check if it's a private IP
    if (isPrivateIP(hostname)) {
      return true;
    }
    
    // Check if it's localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

export default {
  getNetworkInterfaces,
  getLocalIP,
  isPrivateIP,
  logNetworkInfo,
  getClientIP,
  isValidPrivateNetworkOrigin
};
