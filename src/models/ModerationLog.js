import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ModerationLog = sequelize.define('ModerationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  moderatorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('user', 'post', 'job', 'marketplace', 'report', 'comment'),
    allowNull: false
  },
  action: {
    type: DataTypes.ENUM('delete', 'hide', 'restore', 'ban', 'unban', 'resolve_report'),
    allowNull: false
  },
  targetId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'moderation_logs'
});

  ModerationLog.associate = (models) => {
    ModerationLog.belongsTo(models.User, {
      foreignKey: 'moderatorId',
      as: 'moderator'
    });

    // Add polymorphic associations based on type
    ModerationLog.belongsTo(models.User, {
      foreignKey: 'targetId',
      as: 'targetUser',
      constraints: false
    });
    ModerationLog.belongsTo(models.Post, {
      foreignKey: 'targetId',
      as: 'targetPost',
      constraints: false
    });
    ModerationLog.belongsTo(models.Comment, {
      foreignKey: 'targetId',
      as: 'targetComment',
      constraints: false
    });
    ModerationLog.belongsTo(models.Job, {
      foreignKey: 'targetId',
      as: 'targetJob',
      constraints: false
    });
    ModerationLog.belongsTo(models.MarketplaceItem, {
      foreignKey: 'targetId',
      as: 'targetMarketplaceItem',
      constraints: false
    });
    ModerationLog.belongsTo(models.Report, {
      foreignKey: 'targetId',
      as: 'targetReport',
      constraints: false
    });
  };

  return ModerationLog;
};
