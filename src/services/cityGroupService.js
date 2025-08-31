import { Group, GroupMember, User } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Service for handling city-based group operations
 */
class CityGroupService {
  /**
   * Create a city group if it doesn't exist
   * @param {string} cityName - Name of the city
   * @param {string} state - State/province
   * @param {string} country - Country
   * @param {Object} locationData - Additional location data
   * @returns {Promise<Object>} Created or existing group
   */
  async createCityGroup(cityName, state, country, locationData = {}, userId = null) {
    if (!cityName) {
      throw new Error('City name is required');
    }

    // Normalize city name for consistency
    const normalizedCityName = cityName.trim();
    
    // Create a standardized group name
    const groupName = `${cityName} Community`;
    const groupDescription = `Connect with people in ${cityName}${state ? `, ${state}` : ''}${country ? `, ${country}` : ''}. Share local events, news, and connect with your neighbors!`;

    // Check if city group already exists with exact location match
    const whereClause = {
      category: 'city',
      status: 'active',
      'location_json.city': { [Op.iLike]: `%${normalizedCityName}%` }
    };

    if (state) {
      whereClause['location_json.state'] = { [Op.iLike]: `%${state}%` };
    }
    if (country) {
      whereClause['location_json.country'] = { [Op.iLike]: `%${country}%` };
    }

    let cityGroup = await Group.findOne({
      where: whereClause
    });

    if (!cityGroup) {
      // Create new city group
      cityGroup = await Group.create({
        name: groupName,
        description: groupDescription,
        category: 'city',
        privacy: 'public',
        location_json: {
          city: cityName,
          state: state || null,
          country: country || null,
          ...locationData
        },
        settings_json: {
          allowInvites: true,
          requireApproval: false,
          allowPosts: true,
          allowComments: true,
          isCityGroup: true,
          autoJoinEnabled: true
        },
        tags: ['city', 'local', 'community'],
        created_by: userId // Use the user ID as creator
      });
    }

    return cityGroup;
  }

  /**
   * Auto-join user to existing city group based on their location
   * @param {string} userId - User ID
   * @param {string} cityName - City name from user's location
   * @param {string} state - State/province
   * @param {string} country - Country
   * @returns {Promise<Object>} Join result
   */
  async autoJoinCityGroup(userId, cityName, state = null, country = null) {
    if (!userId || !cityName) {
      throw new Error('User ID and city name are required');
    }

    try {
      // Find existing city group
      let cityGroup = await this.findCityGroup(cityName, state, country);

      // If no city group exists, create one automatically
      if (!cityGroup) {
        try {
          const createResult = await this.createCityGroup(cityName, state, country, {}, userId);
          cityGroup = createResult;

        } catch (error) {
          return {
            success: false,
            message: `Failed to create city group for ${cityName}`,
            error: error.message
          };
        }
      }

      // Check if user is already a member
      const existingMembership = await GroupMember.findOne({
        where: {
          group_id: cityGroup.id,
          user_id: userId,
          status: 'active'
        }
      });

      if (existingMembership) {
        return {
          success: true,
          alreadyMember: true,
          message: 'Already a member of this city group',
          group: cityGroup
        };
      }

      // Check if user was previously a member but left
      const previousMembership = await GroupMember.findOne({
        where: {
          group_id: cityGroup.id,
          user_id: userId
        }
      });

      if (previousMembership) {
        // Reactivate membership
        await previousMembership.update({
          status: 'active',
          joinedAt: new Date()
        });
      } else {
        // Create new membership
        await GroupMember.create({
          group_id: cityGroup.id,
          user_id: userId,
          role: 'member',
          status: 'active'
        });
      }

      // Update member count
      await cityGroup.increment('member_count');

      return {
        success: true,
        alreadyMember: false,
        message: `Automatically joined ${cityGroup.name}`,
        group: cityGroup
      };

    } catch (error) {
      console.error('Error in autoJoinCityGroup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all city groups
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of city groups
   */
  async getCityGroups(options = {}) {
    const { page = 1, limit = 20, country, state } = options;
    const offset = (page - 1) * limit;

    const whereClause = {
      category: 'city',
      status: 'active'
    };

    if (country) {
      whereClause['location_json.country'] = country;
    }

    if (state) {
      whereClause['location_json.state'] = state;
    }

    const cityGroups = await Group.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['member_count', 'DESC'], ['createdAt', 'DESC']]
    });

    return {
      items: cityGroups.rows,
      total: cityGroups.count,
      page: parseInt(page),
      totalPages: Math.ceil(cityGroups.count / limit)
    };
  }

  /**
   * Get city groups near a specific location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} radius - Search radius in km
   * @returns {Promise<Array>} Nearby city groups
   */
  async getNearbyCityGroups(latitude, longitude, radius = 50) {
    // This is a simplified implementation
    // In a production environment, you might want to use PostGIS or similar
    // for more accurate geographic queries
    
    const cityGroups = await Group.findAll({
      where: {
        category: 'city',
        status: 'active'
      },
      order: [['member_count', 'DESC']],
      limit: 20
    });

    return cityGroups;
  }

  /**
   * Process user location update and auto-join to existing city group
   * @param {string} userId - User ID
   * @param {Object} locationData - User's location data
   * @returns {Promise<Object>} Auto-join result
   */
  async processLocationUpdate(userId, locationData) {
    const { location_city, location_state, location_country } = locationData;

    if (!location_city) {
      return {
        success: false,
        message: 'City information not available'
      };
    }

    // First, remove user from all other city groups
    await this.removeFromOtherCityGroups(userId, location_city, location_state, location_country);

    // Try to find existing city group
    let cityGroup = await this.findCityGroup(location_city, location_state, location_country);

    // If no city group exists, create one automatically
    if (!cityGroup) {
      try {
        cityGroup = await this.createCityGroup(location_city, location_state, location_country, {}, userId);
      } catch (error) {
        console.error(`Error creating city group for ${location_city}:`, error);
        return {
          success: false,
          message: `Failed to create city group for ${location_city}`,
          error: error.message
        };
      }
    }

    // Now auto-join to the city group (either existing or newly created)
    const result = await this.autoJoinCityGroup(
      userId,
      location_city,
      location_state,
      location_country
    );

    return result;
  }

  /**
   * Remove user from city groups that don't match their current location
   * @param {string} userId - User ID
   * @param {string} currentCity - Current city name
   * @param {string} currentState - Current state/province
   * @param {string} currentCountry - Current country
   * @returns {Promise<Object>} Removal result
   */
  async removeFromOtherCityGroups(userId, currentCity, currentState = null, currentCountry = null) {
    try {
      // Get all city groups the user is a member of
      const userCityMemberships = await GroupMember.findAll({
        include: [
          {
            model: Group,
            as: 'group',
            where: {
              category: 'city',
              status: 'active'
            },
            attributes: ['id', 'name', 'location_json']
          }
        ],
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      let removedCount = 0;
      const removedGroups = [];

      for (const membership of userCityMemberships) {
        const group = membership.group;
        const groupLocation = group.location_json || {};
        
        // Check if this group matches the user's current location
        const isCurrentCityGroup = this.isSameCity(
          currentCity, 
          currentState, 
          currentCountry,
          groupLocation.city,
          groupLocation.state,
          groupLocation.country
        );

        // If not the current city group, remove the user
        if (!isCurrentCityGroup) {
          await membership.update({
            status: 'inactive',
            leftAt: new Date()
          });

          // Decrement member count
          await group.decrement('member_count');
          
          removedCount++;
          removedGroups.push({
            groupId: group.id,
            groupName: group.name,
            city: groupLocation.city
          });
        }
      }

      return {
        success: true,
        removedCount,
        removedGroups,
        message: removedCount > 0 
          ? `Removed from ${removedCount} city group(s)` 
          : 'No city groups to remove from'
      };

    } catch (error) {
      console.error('Error removing from other city groups:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if two city locations are the same
   * @param {string} city1 - First city name
   * @param {string} state1 - First state/province
   * @param {string} country1 - First country
   * @param {string} city2 - Second city name
   * @param {string} state2 - Second state/province
   * @param {string} country2 - Second country
   * @returns {boolean} True if cities are the same
   */
  isSameCity(city1, state1, country1, city2, state2, country2) {
    if (!city1 || !city2) return false;
    
    // Normalize city names for comparison
    const normalizedCity1 = city1.trim().toLowerCase();
    const normalizedCity2 = city2.trim().toLowerCase();
    
    // If cities don't match, they're different
    if (normalizedCity1 !== normalizedCity2) return false;
    
    // If both have states, they should match
    if (state1 && state2) {
      const normalizedState1 = state1.trim().toLowerCase();
      const normalizedState2 = state2.trim().toLowerCase();
      if (normalizedState1 !== normalizedState2) return false;
    }
    
    // If both have countries, they should match
    if (country1 && country2) {
      const normalizedCountry1 = country1.trim().toLowerCase();
      const normalizedCountry2 = country2.trim().toLowerCase();
      if (normalizedCountry1 !== normalizedCountry2) return false;
    }
    
    return true;
  }

  /**
   * Get user's city group memberships
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of city group memberships
   */
  async getUserCityGroupMemberships(userId) {
    try {
      const memberships = await GroupMember.findAll({
        include: [
          {
            model: Group,
            as: 'group',
            where: {
              category: 'city',
              status: 'active'
            },
            attributes: ['id', 'name', 'description', 'location_json', 'member_count', 'post_count', 'created_at', 'updated_at', 'created_by'],
            include: [
              {
                model: User,
                as: 'creator',
                attributes: ['id', 'displayName', 'username', 'avatar_url']
              }
            ]
          }
        ],
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      const result = memberships.map(membership => ({
        id: membership.group.id,
        name: membership.group.name,
        description: membership.group.description,
        category: 'city',
        privacy: 'public',
        memberCount: membership.group.member_count,
        postCount: membership.group.post_count,
        isJoined: true,
        isAdmin: membership.role === 'admin',
        isModerator: membership.role === 'moderator',
        userRole: membership.role,
        createdAt: membership.group.created_at || new Date(),
        updatedAt: membership.group.updated_at || new Date(),
        location: membership.group.location_json,
        location_json: membership.group.location_json,
        createdBy: {
          id: membership.group.created_by,
          displayName: membership.group.creator?.displayName || 'Unknown',
          username: membership.group.creator?.username,
          avatarUrl: membership.group.creator?.avatar_url
        }
      }));

      return result;
    } catch (error) {
      console.error('Error getting user city group memberships:', error);
      return [];
    }
  }

  /**
   * Create a street group if it doesn't exist
   * @param {string} streetName - Name of the street
   * @param {string} city - City name
   * @param {string} state - State/province
   * @param {string} country - Country
   * @param {string} formattedAddress - Full formatted address
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {string} createdBy - User ID who created the group
   * @returns {Promise<Object>} Created or existing group
   */
  async createStreetGroup(streetName, city, state, country, formattedAddress, latitude, longitude, createdBy) {
    if (!streetName || !city) {
      throw new Error('Street name and city are required');
    }

    // Normalize all location components for consistency
    const normalizedStreetName = streetName ? streetName.trim() : '';
    const normalizedCity = city ? city.trim() : '';
    const normalizedState = state ? state.trim() : '';
    const normalizedCountry = country ? country.trim() : '';
    
    // Create a standardized group name
    const groupName = `${normalizedStreetName} Street Community`;
    const groupDescription = `Connect with neighbors on ${normalizedStreetName} in ${normalizedCity}${normalizedState ? `, ${normalizedState}` : ''}${normalizedCountry ? `, ${normalizedCountry}` : ''}. Share local updates, events, and build a stronger neighborhood!`;

    // Check if street group already exists with exact location match
    // First try exact match
    let whereClause = {
      category: 'street',
      status: 'active',
      'location_json.street': normalizedStreetName,
      'location_json.city': normalizedCity
    };

    if (normalizedState) {
      whereClause['location_json.state'] = normalizedState;
    }
    if (normalizedCountry) {
      whereClause['location_json.country'] = normalizedCountry; 
    }

    let streetGroup = await Group.findOne({
      where: whereClause
    });

    // If no exact match, try case-insensitive match
    if (!streetGroup) {
      whereClause = {
        category: 'street',
        status: 'active',
        'location_json.street': { [Op.iLike]: normalizedStreetName },
        'location_json.city': { [Op.iLike]: normalizedCity }
      };

      if (normalizedState) {
        whereClause['location_json.state'] = { [Op.iLike]: normalizedState };
      }
      if (normalizedCountry) {
        whereClause['location_json.country'] = { [Op.iLike]: normalizedCountry };
      }

      streetGroup = await Group.findOne({
        where: whereClause
      });
    }

    // If still no match, try partial match but be more strict
    if (!streetGroup) {
      whereClause = {
        category: 'street',
        status: 'active',
        'location_json.street': { [Op.iLike]: `%${normalizedStreetName}%` },
        'location_json.city': { [Op.iLike]: `%${normalizedCity}%` }
      };

      if (normalizedState) {
        whereClause['location_json.state'] = { [Op.iLike]: `%${normalizedState}%` };
      }
      if (normalizedCountry) {
        whereClause['location_json.country'] = { [Op.iLike]: `%${normalizedCountry}%` };
      }

      streetGroup = await Group.findOne({
        where: whereClause
      });
    }

    if (!streetGroup) {


      // Create new street group
      streetGroup = await Group.create({
        name: groupName,
        description: groupDescription,
        category: 'street',
        privacy: 'public',
        location_json: {
          street: normalizedStreetName,
          city: normalizedCity,
          state: normalizedState || null,
          country: normalizedCountry || null,
          formattedAddress: formattedAddress || null,
          latitude: latitude || null,
          longitude: longitude || null
        },
        settings_json: {
          allowInvites: true,
          requireApproval: false,
          allowPosts: true,
          allowComments: true,
          isStreetGroup: true,
          autoJoinEnabled: true
        },
        tags: ['street', 'neighborhood', 'local', 'community'],
        created_by: createdBy
      });

      return {
        success: true,
        message: `Street group "${groupName}" created successfully`,
        group: streetGroup
      };
    } else {
      return {
        success: false,
        message: `Street group "${groupName}" already exists`,
        group: streetGroup
      };
    }
  }

  /**
   * Get street groups with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Street groups with pagination
   */
  async getStreetGroups(options = {}) {
    const { page = 1, limit = 20, city, state, country } = options;
    const offset = (page - 1) * limit;

    const whereClause = {
      category: 'street',
      status: 'active'
    };

    if (city) {
      whereClause['location_json.city'] = { [Op.iLike]: `%${city}%` };
    }
    if (state) {
      whereClause['location_json.state'] = { [Op.iLike]: `%${state}%` };
    }
    if (country) {
      whereClause['location_json.country'] = { [Op.iLike]: `%${country}%` };
    }

    const streetGroups = await Group.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    return {
      items: streetGroups.rows.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        imageUrl: group.image_url,
        coverImageUrl: group.cover_image_url,
        location: group.location_json,
        memberCount: group.member_count,
        postCount: group.post_count,
        createdAt: group.created_at,
        creator: group.creator
      })),
      total: streetGroups.count,
      page: parseInt(page),
      totalPages: Math.ceil(streetGroups.count / limit)
    };
  }

  /**
   * Get nearby street groups based on coordinates
   * @param {number} latitude - User's latitude
   * @param {number} longitude - User's longitude
   * @param {number} radius - Search radius in km
   * @returns {Promise<Array>} Nearby street groups
   */
  async getNearbyStreetGroups(latitude, longitude, radius = 5) {
    const streetGroups = await Group.findAll({
      where: {
        category: 'street',
        status: 'active',
        'location_json.latitude': { [Op.not]: null },
        'location_json.longitude': { [Op.not]: null }
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ]
    });

    // Filter by distance
    const nearbyGroups = streetGroups.filter(group => {
      const groupLat = group.location_json.latitude;
      const groupLng = group.location_json.longitude;
      
      if (!groupLat || !groupLng) return false;
      
      const distance = this.calculateDistance(latitude, longitude, groupLat, groupLng);
      return distance <= radius;
    });

    return nearbyGroups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      imageUrl: group.image_url,
      coverImageUrl: group.cover_image_url,
      location: group.location_json,
      memberCount: group.member_count,
      postCount: group.post_count,
      createdAt: group.created_at,
      creator: group.creator,
      distance: this.calculateDistance(latitude, longitude, group.location_json.latitude, group.location_json.longitude)
    }));
  }

  /**
   * Auto-join user to existing street group or create one
   * @param {string} userId - User ID
   * @param {string} street - Street name
   * @param {string} city - City name
   * @param {string} state - State/province
   * @param {string} country - Country
   * @returns {Promise<Object>} Join result
   */
  async autoJoinStreetGroup(userId, street, city, state = null, country = null) {
    if (!userId || !city) {
      throw new Error('User ID and city are required');
    }

    try {
      // If no street name, use city as fallback
      const streetName = street || city;
      const groupName = `${streetName} Street Community`;
      const groupDescription = `Connect with neighbors on ${streetName} in ${city}${state ? `, ${state}` : ''}${country ? `, ${country}` : ''}. Share local updates, events, and connect with your street community!`;

      // Check if street group already exists
      const whereClause = {
        category: 'street',
        status: 'active'
      };

      if (street) {
        whereClause['location_json.street'] = { [Op.iLike]: `%${street}%` };
      }
      if (city) {
        whereClause['location_json.city'] = { [Op.iLike]: `%${city}%` };
      }
      if (state) {
        whereClause['location_json.state'] = { [Op.iLike]: `%${state}%` };
      }
      if (country) {
        whereClause['location_json.country'] = { [Op.iLike]: `%${country}%` };
      }

      let streetGroup = await Group.findOne({
        where: whereClause
      });

      if (!streetGroup) {
        // Create new street group
        streetGroup = await Group.create({
          name: groupName,
          description: groupDescription,
          category: 'street',
          privacy: 'public',
          location_json: {
            street: street || null,
            city: city,
            state: state || null,
            country: country || null,
            formattedAddress: `${street || ''}, ${city}, ${state || ''}, ${country || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '')
          },
          settings_json: {
            allowInvites: true,
            requireApproval: false,
            allowPosts: true,
            allowComments: true,
            isStreetGroup: true,
            autoJoinEnabled: true
          },
          tags: ['street', 'local', 'neighborhood'],
          created_by: userId
        });

        console.log(`✅ Created new street group: ${groupName}`);
      }

      // Check if user is already a member
      const existingMembership = await GroupMember.findOne({
        where: {
          group_id: streetGroup.id,
          user_id: userId
        }
      });

      if (existingMembership) {
        if (existingMembership.status === 'active') {
          console.log(`✅ User already active member of street group: ${streetGroup.name}`);
          return {
            success: true,
            message: 'Already a member of this street group',
            group: streetGroup
          };
        } else {
          // Reactivate membership
          await existingMembership.update({
            status: 'active',
            joined_at: new Date()
          });
          console.log(`✅ Reactivated membership for street group: ${streetGroup.name}`);
        }
      } else {
        // Create new membership
        await GroupMember.create({
          group_id: streetGroup.id,
          user_id: userId,
          role: 'member',
          status: 'active',
          joined_at: new Date()
        });
        console.log(`✅ Added user to street group: ${streetGroup.name}`);
      }

      // Update member count
      await streetGroup.update({
        member_count: streetGroup.member_count + 1
      });

      return {
        success: true,
        message: 'Successfully joined street group',
        group: streetGroup
      };

    } catch (error) {
      console.error('Error auto-joining street group:', error);
      return {
        success: false,
        message: 'Failed to join street group',
        error: error.message
      };
    }
  }

  /**
   * Remove user from other street groups when their location changes
   * @param {string} userId - User ID
   * @param {string} streetName - Current street name
   * @param {string} city - Current city name
   * @param {string} state - Current state/province
   * @param {string} country - Current country
   * @param {string} formattedAddress - Current formatted address
   * @returns {Promise<Object>} Result of removal operation
   */
  async removeFromOtherStreetGroups(userId, streetName, city, state, country, formattedAddress) {
    try {
      // Get all user's active street group memberships
      const userMemberships = await GroupMember.findAll({
        where: {
          user_id: userId,
          status: 'active'
        },
        include: [
          {
            model: Group,
            as: 'group',
            where: {
              category: 'street',
              status: 'active'
            },
            attributes: ['id', 'name', 'location_json']
          }
        ]
      });

      let removedCount = 0;

      for (const membership of userMemberships) {
        const group = membership.group;
        const groupLocation = group.location_json;

        // Check if this group matches the user's current location
        // Use case-insensitive comparison and handle null/undefined values
        const normalizeString = (str) => str ? str.trim().toLowerCase() : '';
        
        const isCurrentLocation = (
          normalizeString(groupLocation.street) === normalizeString(streetName) &&
          normalizeString(groupLocation.city) === normalizeString(city) &&
          normalizeString(groupLocation.state) === normalizeString(state) &&
          normalizeString(groupLocation.country) === normalizeString(country)
        );





        // If not current location, deactivate membership
        if (!isCurrentLocation) {
          await membership.update({
            status: 'inactive',
            left_at: new Date()
          });

          // Update group member count
          await group.update({
            member_count: Math.max(0, group.member_count - 1)
          });

          removedCount++;
        }
      }

      return {
        success: true,
        message: `Removed from ${removedCount} other street groups`,
        removedCount
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove from other street groups',
        error: error.message,
        removedCount: 0
      };
    }
  }

  /**
   * Find existing city group by location
   * @param {string} cityName - City name
   * @param {string} state - State/province
   * @param {string} country - Country
   * @returns {Promise<Object|null>} City group or null
   */
  async findCityGroup(cityName, state = null, country = null) {
    const normalizedCityName = cityName.trim();
    
    // First try exact match
    let whereClause = {
      category: 'city',
      status: 'active',
      'location_json.city': normalizedCityName
    };

    if (state) {
      whereClause['location_json.state'] = state;
    }
    if (country) {
      whereClause['location_json.country'] = country;
    }

    let cityGroup = await Group.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ]
    });

    // If no exact match, try case-insensitive exact match
    if (!cityGroup) {
      whereClause = {
        category: 'city',
        status: 'active',
        'location_json.city': { [Op.iLike]: normalizedCityName }
      };

      if (state) {
        whereClause['location_json.state'] = { [Op.iLike]: state };
      }
      if (country) {
        whereClause['location_json.country'] = { [Op.iLike]: country };
      }

      cityGroup = await Group.findOne({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'displayName', 'username', 'avatar_url']
          }
        ]
      });
    }

    // If still no match, try partial match as last resort
    if (!cityGroup) {
      whereClause = {
        category: 'city',
        status: 'active',
        'location_json.city': { [Op.iLike]: `%${normalizedCityName}%` }
      };

      if (state) {
        whereClause['location_json.state'] = { [Op.iLike]: `%${state}%` };
      }
      if (country) {
        whereClause['location_json.country'] = { [Op.iLike]: `%${country}%` };
      }

      cityGroup = await Group.findOne({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'displayName', 'username', 'avatar_url']
          }
        ]
      });
    }

    return cityGroup;
  }

  /**
   * Find existing street group by location
   * @param {string} streetName - Street name
   * @param {string} city - City name
   * @param {string} state - State/province
   * @param {string} country - Country
   * @returns {Promise<Object|null>} Street group or null
   */
  async findStreetGroup(streetName, city, state = null, country = null) {
    // Normalize all location components for consistency
    const normalizedStreetName = streetName ? streetName.trim() : '';
    const normalizedCity = city ? city.trim() : '';
    const normalizedState = state ? state.trim() : '';
    const normalizedCountry = country ? country.trim() : '';
    

    
    // First try exact match
    let whereClause = {
      category: 'street',
      status: 'active',
      'location_json.street': normalizedStreetName,
      'location_json.city': normalizedCity
    };

    if (normalizedState) {
      whereClause['location_json.state'] = normalizedState;
    }
    if (normalizedCountry) {
      whereClause['location_json.country'] = normalizedCountry;
    }

    let streetGroup = await Group.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ]
    });

    // If no exact match, try case-insensitive match
    if (!streetGroup) {
      whereClause = {
        category: 'street',
        status: 'active',
        'location_json.street': { [Op.iLike]: normalizedStreetName },
        'location_json.city': { [Op.iLike]: normalizedCity }
      };

      if (normalizedState) {
        whereClause['location_json.state'] = { [Op.iLike]: normalizedState };
      }
      if (normalizedCountry) {
        whereClause['location_json.country'] = { [Op.iLike]: normalizedCountry };
      }

      streetGroup = await Group.findOne({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'displayName', 'username', 'avatar_url']
          }
        ]
      });
    }

    // If still no match, try partial match but be more strict
    if (!streetGroup) {
      whereClause = {
        category: 'street',
        status: 'active',
        'location_json.street': { [Op.iLike]: `%${normalizedStreetName}%` },
        'location_json.city': { [Op.iLike]: `%${normalizedCity}%` }
      };

      if (normalizedState) {
        whereClause['location_json.state'] = { [Op.iLike]: `%${normalizedState}%` };
      }
      if (normalizedCountry) {
        whereClause['location_json.country'] = { [Op.iLike]: `%${normalizedCountry}%` };
      }

      streetGroup = await Group.findOne({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'displayName', 'username', 'avatar_url']
          }
        ]
      });
    }

    return streetGroup;
  }

  /**
   * Get user's street group memberships
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of street group memberships
   */
  async getUserStreetGroupMemberships(userId) {
    try {
      console.log(`🔍 Getting street group memberships for user: ${userId}`);
      
      // Get user's current location first
      const { User } = await import('../models/index.js');
      const user = await User.findByPk(userId);
      
      if (!user) {
        console.log('❌ User not found');
        return [];
      }
      
      console.log(`📍 User location: ${user.location_street}, ${user.location_city}, ${user.location_state}, ${user.location_country}`);
      
      // Get all active street group memberships for this user
      const memberships = await GroupMember.findAll({
        include: [
          {
            model: Group,
            as: 'group',
            where: {
              category: 'street',
              status: 'active'
            },
            attributes: ['id', 'name', 'description', 'location_json', 'member_count', 'post_count', 'created_at', 'updated_at', 'created_by'],
            include: [
              {
                model: User,
                as: 'creator',
                attributes: ['id', 'displayName', 'username', 'avatar_url']
              }
            ]
          }
        ],
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      console.log(`✅ Found ${memberships.length} active street group memberships`);

      // If no street groups found, try to auto-create and join one
      if (memberships.length === 0 && user.location_city) {
        console.log('🔄 No street groups found, attempting to auto-create...');
        try {
          await this.autoJoinStreetGroup(userId, user.location_street, user.location_city, user.location_state, user.location_country);
          
          // Try to get memberships again after auto-join
          const newMemberships = await GroupMember.findAll({
            include: [
              {
                model: Group,
                as: 'group',
                where: {
                  category: 'street',
                  status: 'active'
                },
                attributes: ['id', 'name', 'description', 'location_json', 'member_count', 'post_count', 'created_at', 'updated_at', 'created_by'],
                include: [
                  {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'displayName', 'username', 'avatar_url']
                  }
                ]
              }
            ],
            where: {
              user_id: userId,
              status: 'active'
            }
          });
          
          console.log(`✅ After auto-join, found ${newMemberships.length} street group memberships`);
          
          const result = newMemberships.map(membership => ({
            id: membership.group.id,
            name: membership.group.name,
            description: membership.group.description,
            category: 'street',
            privacy: 'public',
            memberCount: membership.group.member_count,
            postCount: membership.group.post_count,
            isJoined: true,
            isAdmin: membership.role === 'admin',
            isModerator: membership.role === 'moderator',
            userRole: membership.role,
            createdAt: membership.group.created_at || new Date(),
            updatedAt: membership.group.updated_at || new Date(),
            location: membership.group.location_json,
            location_json: membership.group.location_json,
            createdBy: {
              id: membership.group.created_by,
              displayName: membership.group.creator?.displayName || 'Unknown',
              username: membership.group.creator?.username,
              avatarUrl: membership.group.creator?.avatar_url
            }
          }));

          console.log(`📋 Returning ${result.length} street groups:`, result.map(g => g.name));
          return result;
        } catch (autoJoinError) {
          console.error('❌ Auto-join street group failed:', autoJoinError);
        }
      }

      const result = memberships.map(membership => ({
        id: membership.group.id,
        name: membership.group.name,
        description: membership.group.description,
        category: 'street',
        privacy: 'public',
        memberCount: membership.group.member_count,
        postCount: membership.group.post_count,
        isJoined: true,
        isAdmin: membership.role === 'admin',
        isModerator: membership.role === 'moderator',
        userRole: membership.role,
        createdAt: membership.group.created_at || new Date(),
        updatedAt: membership.group.updated_at || new Date(),
        location: membership.group.location_json,
        location_json: membership.group.location_json,
        createdBy: {
          id: membership.group.created_by,
          displayName: membership.group.creator?.displayName || 'Unknown',
          username: membership.group.creator?.username,
          avatarUrl: membership.group.creator?.avatar_url
        }
      }));

      console.log(`📋 Returning ${result.length} street groups:`, result.map(g => g.name));
      return result;
    } catch (error) {
      console.error('❌ Error getting street group memberships:', error);
      return [];
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  /**
   * Convert degrees to radians
   * @param {number} deg - Degrees
   * @returns {number} Radians
   */
  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Clean up duplicate groups and ensure unique group creation
   * @param {string} category - Group category ('city' or 'street')
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupDuplicateGroups(category = 'city') {
    try {
      const { Group, GroupMember } = await import('../models/index.js');
      
      // Find all groups of the specified category
      const groups = await Group.findAll({
        where: {
          category: category,
          status: 'active'
        },
        order: [['createdAt', 'ASC']]
      });

      const duplicates = [];
      const uniqueGroups = new Map();

      // Group by location to find duplicates
      groups.forEach(group => {
        const locationKey = this.getLocationKey(group.location_json, category);
        
        if (uniqueGroups.has(locationKey)) {
          duplicates.push({
            duplicate: group,
            original: uniqueGroups.get(locationKey)
          });
        } else {
          uniqueGroups.set(locationKey, group);
        }
      });

      // Merge duplicates into original groups
      for (const { duplicate, original } of duplicates) {
        // Move all members from duplicate to original
        const duplicateMembers = await GroupMember.findAll({
          where: {
            group_id: duplicate.id,
            status: 'active'
          }
        });

        for (const member of duplicateMembers) {
          // Check if member already exists in original group
          const existingMember = await GroupMember.findOne({
            where: {
              group_id: original.id,
              user_id: member.user_id
            }
          });

          if (!existingMember) {
            // Move member to original group
            await GroupMember.create({
              group_id: original.id,
              user_id: member.user_id,
              role: member.role,
              status: member.status,
              joinedAt: member.joinedAt
            });
          }
        }

        // Update member count for original group
        const originalMemberCount = await GroupMember.count({
          where: {
            group_id: original.id,
            status: 'active'
          }
        });
        await original.update({ member_count: originalMemberCount });

        // Delete duplicate group
        await duplicate.destroy();
      }

      return {
        success: true,
        message: `Cleaned up ${duplicates.length} duplicate ${category} groups`,
        duplicatesRemoved: duplicates.length
      };
    } catch (error) {
      console.error('Error cleaning up duplicate groups:', error);
      return {
        success: false,
        message: 'Failed to clean up duplicate groups',
        error: error.message
      };
    }
  }

  /**
   * Clean up duplicate street groups specifically
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupDuplicateStreetGroups() {
    try {
      const { Group, GroupMember } = await import('../models/index.js');
      
      // Find all street groups
      const streetGroups = await Group.findAll({
        where: {
          category: 'street',
          status: 'active'
        },
        order: [['createdAt', 'ASC']]
      });

      const duplicates = [];
      const uniqueGroups = new Map();

      // Group by normalized location to find duplicates
      streetGroups.forEach(group => {
        const location = group.location_json || {};
        const normalizedStreet = (location.street || '').trim().toLowerCase();
        const normalizedCity = (location.city || '').trim().toLowerCase();
        const normalizedState = (location.state || '').trim().toLowerCase();
        const normalizedCountry = (location.country || '').trim().toLowerCase();
        
        // Create a location key for comparison
        const locationKey = `${normalizedStreet}|${normalizedCity}|${normalizedState}|${normalizedCountry}`;
        
        if (uniqueGroups.has(locationKey)) {
          duplicates.push({
            duplicate: group,
            original: uniqueGroups.get(locationKey)
          });
        } else {
          uniqueGroups.set(locationKey, group);
        }
      });



      // Merge duplicates into original groups
      for (const { duplicate, original } of duplicates) {

        
        // Move all members from duplicate to original
        const duplicateMembers = await GroupMember.findAll({
          where: {
            group_id: duplicate.id,
            status: 'active'
          }
        });

        for (const member of duplicateMembers) {
          // Check if member already exists in original group
          const existingMember = await GroupMember.findOne({
            where: {
              group_id: original.id,
              user_id: member.user_id
            }
          });

          if (!existingMember) {
            // Move member to original group
            await GroupMember.create({
              group_id: original.id,
              user_id: member.user_id,
              role: member.role,
              status: member.status,
              joined_at: member.joined_at
            });
          }
        }

        // Update member count for original group
        const originalMemberCount = await GroupMember.count({
          where: {
            group_id: original.id,
            status: 'active'
          }
        });
        await original.update({ member_count: originalMemberCount });

        // Delete duplicate group
        await duplicate.destroy();
      }

      return {
        success: true,
        message: `Cleaned up ${duplicates.length} duplicate street groups`,
        duplicatesRemoved: duplicates.length
      };
    } catch (error) {
      console.error('Error cleaning up duplicate street groups:', error);
      return {
        success: false,
        message: 'Failed to clean up duplicate street groups',
        error: error.message
      };
    }
  }

  /**
   * Get location key for grouping similar locations
   * @param {Object} location - Location object
   * @param {string} category - Group category
   * @returns {string} Location key
   */
  getLocationKey(location, category) {
    if (category === 'city') {
      return `${location.city?.toLowerCase()}_${location.state?.toLowerCase()}_${location.country?.toLowerCase()}`;
    } else if (category === 'street') {
      return `${location.street?.toLowerCase()}_${location.city?.toLowerCase()}_${location.state?.toLowerCase()}_${location.country?.toLowerCase()}`;
    }
    return '';
  }

  /**
   * Delete group member from database when user location doesn't match group location
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @param {string} reason - Reason for deletion (e.g., 'location_mismatch')
   * @returns {Promise<Object>} Deletion result
   */
  async deleteGroupMember(userId, groupId, reason = 'location_mismatch') {
    try {
      const { GroupMember, Group } = await import('../models/index.js');
      
      // Find the membership
      const membership = await GroupMember.findOne({
        where: {
          user_id: userId,
          group_id: groupId
        },
        include: [
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name', 'member_count']
          }
        ]
      });

      if (!membership) {
        return {
          success: false,
          message: 'Membership not found'
        };
      }

      // Delete the membership from database
      await membership.destroy();

      // Update group member count
      if (membership.group) {
        await membership.group.update({
          member_count: Math.max(0, membership.group.member_count - 1)
        });
      }

      

      return {
        success: true,
        message: `Successfully removed user from group`,
        data: {
          userId,
          groupId,
          groupName: membership.group?.name,
          reason
        }
      };

    } catch (error) {
      console.error('Error deleting group member:', error);
      return {
        success: false,
        message: 'Failed to delete group member',
        error: error.message
      };
    }
  }

  /**
   * Remove user from groups where location doesn't match and delete from database
   * @param {string} userId - User ID
   * @param {Object} userLocation - User's current location
   * @returns {Promise<Object>} Removal result
   */
  async removeAndDeleteFromMismatchedGroups(userId, userLocation) {
    try {
      const { city, state, country, street } = userLocation;
      let removedCount = 0;
      const removedGroups = [];

      // Get all user's active group memberships
      const { GroupMember, Group } = await import('../models/index.js');
      const userMemberships = await GroupMember.findAll({
        where: {
          user_id: userId,
          status: 'active'
        },
        include: [
          {
            model: Group,
            as: 'group',
            where: {
              status: 'active'
            },
            attributes: ['id', 'name', 'category', 'location_json', 'member_count']
          }
        ]
      });

      for (const membership of userMemberships) {
        const group = membership.group;
        const groupLocation = group.location_json || {};
        let shouldRemove = false;

        if (group.category === 'city') {
          // Check city group location mismatch
          const isCurrentCityGroup = this.isSameCity(
            city, state, country,
            groupLocation.city, groupLocation.state, groupLocation.country
          );
          shouldRemove = !isCurrentCityGroup;
        } else if (group.category === 'street') {
          // Check street group location mismatch
          const normalizeString = (str) => str ? str.trim().toLowerCase() : '';
          const isCurrentLocation = (
            normalizeString(groupLocation.street) === normalizeString(street) &&
            normalizeString(groupLocation.city) === normalizeString(city) &&
            normalizeString(groupLocation.state) === normalizeString(state) &&
            normalizeString(groupLocation.country) === normalizeString(country)
          );
          shouldRemove = !isCurrentLocation;
        }

        if (shouldRemove) {
          // Delete the membership from database
          const deleteResult = await this.deleteGroupMember(userId, group.id, 'location_mismatch');
          
          if (deleteResult.success) {
            removedCount++;
            removedGroups.push({
              groupId: group.id,
              groupName: group.name,
              category: group.category,
              reason: 'location_mismatch'
            });
          }
        }
      }

      return {
        success: true,
        message: `Removed and deleted ${removedCount} memberships from mismatched groups`,
        data: {
          removedCount,
          removedGroups,
          userLocation
        }
      };

    } catch (error) {
      console.error('Error removing from mismatched groups:', error);
      return {
        success: false,
        message: 'Failed to remove from mismatched groups',
        error: error.message
      };
    }
  }

  /**
   * Audit and fix user group memberships based on current location
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Audit and fix result
   */
  async auditAndFixUserMemberships(userId) {
    try {
      // Get user's current location
      const { User } = await import('../models/index.js');
      const user = await User.findByPk(userId);
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Clean up city group memberships
      const cityCleanupResult = await this.removeFromOtherCityGroups(
        userId,
        user.location_city,
        user.location_state,
        user.location_country
      );

      // Clean up street group memberships
      const streetCleanupResult = await this.removeFromOtherStreetGroups(
        userId,
        user.location_street,
        user.location_city,
        user.location_state,
        user.location_country,
        user.location_formatted_address
      );

      // Auto-join to current location groups if not already a member
      let autoJoinResult = null;
      if (user.location_city) {
        autoJoinResult = await this.processLocationUpdate(userId, {
          location_city: user.location_city,
          location_state: user.location_state,
          location_country: user.location_country
        });
      }

      // Get final memberships after cleanup
      const finalCityMemberships = await this.getUserCityGroupMemberships(userId);
      const finalStreetMemberships = await this.getUserStreetGroupMemberships(userId);

      const result = {
        success: true,
        message: 'Membership audit and fix completed',
        data: {
          userLocation: {
            city: user.location_city,
            state: user.location_state,
            country: user.location_country,
            street: user.location_street
          },
          cityCleanup: cityCleanupResult,
          streetCleanup: streetCleanupResult,
          autoJoin: autoJoinResult,
          finalMemberships: {
            city: finalCityMemberships.length,
            street: finalStreetMemberships.length
          }
        }
      };

      return result;

    } catch (error) {
      console.error('Error auditing user memberships:', error);
      return {
        success: false,
        message: 'Failed to audit memberships',
        error: error.message
      };
    }
  }
}

export default new CityGroupService();
