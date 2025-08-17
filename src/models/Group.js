import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cover_image_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'general'
  },
  privacy: {
    type: DataTypes.ENUM('public', 'private', 'secret'),
    allowNull: false,
    defaultValue: 'public'
  },
  member_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  post_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  rules: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  location_json: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  settings_json: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      allowInvites: true,
      requireApproval: false,
      allowPosts: true,
      allowComments: true
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'deleted'),
    allowNull: false,
    defaultValue: 'active'
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'groups',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['category']
    },
    {
      fields: ['privacy']
    },
    {
      fields: ['status']
    },
    {
      fields: ['created_by']
    }
  ]
});

export default Group;
