export default (sequelize, DataTypes) => {
  const BlockedUser = sequelize.define('BlockedUser', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    blocker_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    blocked_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    
    // Blocking Details
    reason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
  tableName: 'blocked_users',
  timestamps: true,
  underscored: true,
  indexes: [
      {
        unique: true,
        fields: ['blocker_id', 'blocked_id']
      },
      {
        fields: ['blocker_id']
      },
      {
        fields: ['blocked_id']
      }
    ]
  });

  BlockedUser.associate = (models) => {
    BlockedUser.belongsTo(models.User, {
      foreignKey: 'blocker_id',
      as: 'blocker'
    });
    BlockedUser.belongsTo(models.User, {
      foreignKey: 'blocked_id',
      as: 'blocked'
    });
  };

  return BlockedUser;
};
