export default (sequelize, DataTypes) => {
  const Connection = sequelize.define('Connection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id1: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id1',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    user_id2: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id2',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'blocked'),
      defaultValue: 'pending',
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
  tableName: 'connections',
  timestamps: true,
  underscored: true,
  indexes: [
      { fields: ['user_id1'] },
      { fields: ['user_id2'] },
      { fields: ['status'] },
      { 
        unique: true, 
        fields: ['user_id1', 'user_id2'],
        name: 'unique_user_connection'
      }
    ],
    hooks: {
      beforeCreate: (connection) => {
        // Ensure user_id1 is always the smaller UUID to maintain consistency
        if (connection.user_id1 > connection.user_id2) {
          [connection.user_id1, connection.user_id2] = [connection.user_id2, connection.user_id1];
        }
      }
    }
  });

  // Instance methods
  Connection.prototype.isAccepted = function() {
    return this.status === 'accepted';
  };

  Connection.prototype.isPending = function() {
    return this.status === 'pending';
  };

  Connection.prototype.isRejected = function() {
    return this.status === 'rejected';
  };

  Connection.prototype.isBlocked = function() {
    return this.status === 'blocked';
  };

  // Class methods
  Connection.findConnection = function(userId1, userId2) {
    // Ensure consistent ordering of user IDs
    const [smallerId, largerId] = [userId1, userId2].sort();
    return this.findOne({
      where: {
        user_id1: smallerId,
        user_id2: largerId
      }
    });
  };

  Connection.findUserConnections = function(userId, status = null) {
    const whereClause = {
      [sequelize.Op.or]: [
        { user_id1: userId },
        { user_id2: userId }
      ]
    };

    if (status) {
      whereClause.status = status;
    }

    return this.findAll({
      where: whereClause,
      include: [
        {
          model: sequelize.models.User,
          as: 'user1',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        },
        {
          model: sequelize.models.User,
          as: 'user2',
          attributes: ['id', 'displayName', 'username', 'avatar_url']
        }
      ]
    });
  };

  return Connection;
};
