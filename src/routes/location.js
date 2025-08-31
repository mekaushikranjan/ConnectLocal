import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { User, LocationSettings, LocationHistory } from '../models/index.js';
import { Op, Sequelize } from 'sequelize';
import cityGroupService from '../services/cityGroupService.js';
import { parseFormattedAddress } from '../utils/locationUtils.js';

const router = express.Router();

/**
 * @route   GET /api/location/nearby-users
 * @desc    Get users near a location
 * @access  Private
 */
router.get('/nearby-users', authenticate, asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 10, limit = 20, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  // Calculate bounding box for initial filtering
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const radiusInKm = parseFloat(radius);

  // Rough approximation: 1 degree = 111km
  const latRange = radiusInKm / 111.0;
  const lonRange = radiusInKm / (111.0 * Math.cos(lat * Math.PI / 180));

  const users = await User.findAndCountAll({
    where: {
      id: { [Op.ne]: req.user.id },
      latitude: { [Op.between]: [lat - latRange, lat + latRange] },
      longitude: { [Op.between]: [lon - lonRange, lon + lonRange] }
    },
    attributes: [
      'id',
      'displayName',
      'username',
      'avatar_url',
      'latitude',
      'longitude',
      'last_active',
      [
        Sequelize.literal(`
          6371 * acos(
            cos(radians(${lat})) * 
            cos(radians(latitude)) * 
            cos(radians(longitude) - radians(${lon})) + 
            sin(radians(${lat})) * 
            sin(radians(latitude))
          )
        `),
        'distance'
      ]
    ],
    having: Sequelize.literal(`distance <= ${radiusInKm}`),
    order: [[Sequelize.literal('distance'), 'ASC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  res.json({
    success: true,
    data: {
      users: users.rows,
      total: users.count,
      page: parseInt(page),
      totalPages: Math.ceil(users.count / limit)
    }
  });
}));

/**
 * @route   PUT /api/location/update
 * @desc    Update user's location and auto-join city group
 * @access  Private
 */
router.put('/update', authenticate, asyncHandler(async (req, res) => {
  const { 
    latitude, 
    longitude, 
    address,
    location_city,
    location_state,
    location_country,
    location_street,
    location_postal_code,
    location_formatted_address
  } = req.body;

  const user = await User.findByPk(req.user.id);
  
  // Update location fields
  user.latitude = latitude;
  user.longitude = longitude;
  user.location_city = location_city;
  user.location_state = location_state;
  user.location_country = location_country;
  user.location_street = location_street;
  user.location_postal_code = location_postal_code;
  user.location_formatted_address = location_formatted_address;
  user.location_last_updated = new Date();
  
  if (address) {
    user.address = address;
  }
  
  await user.save();

  // Process group memberships based on new location
  let membershipResult = null;
  if (location_city || location_street) {
    try {
      membershipResult = await cityGroupService.auditAndFixUserMemberships(req.user.id);
        } catch (error) {
      // Don't fail the location update if membership processing fails
    }
  }

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      latitude: user.latitude,
      longitude: user.longitude,
      address: user.address,
      location_city: user.location_city,
      location_state: user.location_state,
      location_country: user.location_country,
      membershipResult
    }
  });
}));

/**
 * @route   GET /api/location/settings
 * @desc    Get user's location settings
 * @access  Private
 */
router.get('/settings', authenticate, asyncHandler(async (req, res) => {
  const settings = await LocationSettings.getUserSettings(req.user.id);

  res.json({
    success: true,
    data: { settings }
  });
}));

/**
 * @route   PUT /api/location/settings
 * @desc    Update user's location settings
 * @access  Private
 */
router.put('/settings', authenticate, asyncHandler(async (req, res) => {
  const { settings } = req.body;

  const locationSettings = await LocationSettings.getUserSettings(req.user.id);
  await locationSettings.updateSettings(settings);

  res.json({
    success: true,
    message: 'Location settings updated successfully',
    data: { settings: locationSettings }
  });
}));

/**
 * @route   GET /api/location/history
 * @desc    Get user's location history
 * @access  Private
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, startDate, endDate, source } = req.query;
  const offset = (page - 1) * limit;

  const options = {
    limit: parseInt(limit),
    offset: parseInt(offset),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    source,
    includePrivate: false
  };

  const history = await LocationHistory.getUserHistory(req.user.id, options);

  res.json({
    success: true,
    data: {
      history: history.rows,
      total: history.count,
      page: parseInt(page),
      totalPages: Math.ceil(history.count / limit)
    }
  });
}));

/**
 * @route   DELETE /api/location/history
 * @desc    Clear user's location history
 * @access  Private
 */
router.delete('/history', authenticate, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const deletedCount = await LocationHistory.destroy({
    where: {
      user_id: req.user.id,
      timestamp: {
        [Op.lt]: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    }
  });

  res.json({
    success: true,
    message: `Cleared ${deletedCount} location history entries`,
    data: { deletedCount }
  });
}));

/**
 * @route   POST /api/location/update-current
 * @desc    Update user's current location
 * @access  Private
 */
router.post('/update-current', authenticate, asyncHandler(async (req, res) => {
  const { 
    latitude, 
    longitude, 
    locationName, 
    formattedAddress, 
    accuracy, 
    source = 'auto',
    // Direct location components from frontend
    location_city,
    location_state,
    location_country,
    location_street,
    location_postal_code
  } = req.body;

  // Use direct location components if available, otherwise parse formatted address
  let addressComponents = {};
  if (location_city || location_street) {
    // Use direct location components from frontend
    addressComponents = {
      street: location_street || '',
      city: location_city || '',
      state: location_state || '',
      country: location_country || '',
      postalCode: location_postal_code || ''
    };
  } else {
    // Fallback to parsing formatted address
    addressComponents = parseFormattedAddress(formattedAddress);
  }



  // Update user's current location
  const user = await User.findByPk(req.user.id);
  user.latitude = latitude;
  user.longitude = longitude;
  user.location_formatted_address = formattedAddress;
  user.location_street = addressComponents.street;
  user.location_city = addressComponents.city;
  user.location_state = addressComponents.state;
  user.location_country = addressComponents.country;
  user.location_postal_code = addressComponents.postalCode;
  user.location_last_updated = new Date();
  await user.save();



  // Auto-join city group if city information is available
  let autoJoinResult = null;
  if (addressComponents.city) {
    try {


      autoJoinResult = await cityGroupService.processLocationUpdate(req.user.id, {
        location_city: addressComponents.city,
        location_state: addressComponents.state,
        location_country: addressComponents.country
      });


      
    } catch (error) {
      // Don't fail the location update if auto-join fails
    }
  }

  // Auto-join street group if street information is available
  let streetAutoJoinResult = null;
  if (addressComponents.street && addressComponents.city) {
    try {


      // First remove from other street groups
      const removeResult = await cityGroupService.removeFromOtherStreetGroups(
        req.user.id,
        addressComponents.street,
        addressComponents.city,
        addressComponents.state,
        addressComponents.country,
        formattedAddress
      );

      // Then auto-join to current street group
      const joinResult = await cityGroupService.autoJoinStreetGroup(
        req.user.id,
        addressComponents.street,
        addressComponents.city,
        addressComponents.state,
        addressComponents.country,
        formattedAddress
      );

      streetAutoJoinResult = {
        removeResult,
        joinResult
      };



    } catch (error) {
      console.error('❌ Error in street group auto-join:', error);
      // Don't fail the location update if street auto-join fails
    }
  }

  // Get location settings
  const settings = await LocationSettings.getUserSettings(req.user.id);

  // Add to history if enabled
  if (settings.locationHistory) {
    await LocationHistory.addEntry(req.user.id, {
      latitude,
      longitude,
      locationName,
      formattedAddress,
      accuracy,
      source
    });
  }

  // Update settings if auto-detect is enabled
  if (settings.autoDetect && locationName) {
    settings.currentLocation = locationName;
    await settings.save();
  }

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      latitude: user.latitude,
      longitude: user.longitude,
      formattedAddress: user.location_formatted_address,
      locationStreet: user.location_street,
      locationCity: user.location_city,
      locationState: user.location_state,
      locationCountry: user.location_country,
      locationPostalCode: user.location_postal_code,
      lastUpdated: user.location_last_updated,
      autoJoinResult,
      streetAutoJoinResult
    }
  });
}));

/**
 * @route   POST /api/location/set-custom
 * @desc    Set custom location
 * @access  Private
 */
router.post('/set-custom', authenticate, asyncHandler(async (req, res) => {
  const { locationName, latitude, longitude, formattedAddress } = req.body;

  const settings = await LocationSettings.getUserSettings(req.user.id);
  settings.customLocation = locationName;
  settings.currentLocation = locationName;
  await settings.save();

  // Update user's location if coordinates provided
  if (latitude && longitude) {
    const user = await User.findByPk(req.user.id);
    user.latitude = latitude;
    user.longitude = longitude;
    user.location_formatted_address = formattedAddress || locationName;
    
    // Parse formatted address into individual components
    const addressComponents = parseFormattedAddress(formattedAddress || locationName);
    user.location_street = addressComponents.street;
    user.location_city = addressComponents.city;
    user.location_state = addressComponents.state;
    user.location_country = addressComponents.country;
    user.location_postal_code = addressComponents.postalCode;
    
    user.location_last_updated = new Date();
    await user.save();

    // Add to history if enabled
    if (settings.locationHistory) {
      await LocationHistory.addEntry(req.user.id, {
        latitude,
        longitude,
        locationName,
        formattedAddress,
        source: 'manual'
      });
    }
  }

  res.json({
    success: true,
    message: 'Custom location set successfully',
    data: { 
      customLocation: settings.customLocation,
      currentLocation: settings.currentLocation
    }
  });
}));

/**
 * @route   GET /api/location/search
 * @desc    Search for locations (cities, addresses, etc.)
 * @access  Private
 */
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
  }

  // This would typically integrate with a geocoding service like Google Places API
  // For now, we'll return a mock response
  const mockLocations = [
    {
      id: '1',
      name: 'New York, NY',
      type: 'city',
      latitude: 40.7128,
      longitude: -74.0060
    },
    {
      id: '2',
      name: 'Los Angeles, CA',
      type: 'city',
      latitude: 34.0522,
      longitude: -118.2437
    }
  ];

  res.json({
    success: true,
    data: { locations: mockLocations }
  });
}));

/**
 * @route   POST /api/location/check
 * @desc    Check and parse location data from formatted address
 * @access  Private
 */
router.post('/check', authenticate, asyncHandler(async (req, res) => {
  const { formattedAddress } = req.body;

  if (!formattedAddress) {
    return res.status(400).json({
      success: false,
      message: 'Formatted address is required'
    });
  }

  // Parse the formatted address
  const addressComponents = parseFormattedAddress(formattedAddress);

  res.json({
    success: true,
    message: 'Location parsed successfully',
    data: {
      originalAddress: formattedAddress,
      parsedComponents: addressComponents,
      street: addressComponents.street,
      city: addressComponents.city,
      state: addressComponents.state,
      country: addressComponents.country,
      postalCode: addressComponents.postalCode
    }
  });
}));

export default router;
