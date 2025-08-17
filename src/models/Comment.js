import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 1000] // Maximum comment length of 1000 characters
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: { model: 'users', key: 'id' }
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'post_id',
    references: { model: 'posts', key: 'id' }
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'parent_id',
    references: { model: 'comments', key: 'id' }
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'hidden', 'deleted'),
    defaultValue: 'active'
  },
  editHistory: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'edit_history'
  },
  metadataJsonb: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'metadata_jsonb'
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Enable soft deletes
  indexes: [
    { fields: ['post_id'] },
    { fields: ['user_id'] },
    { fields: ['parent_id'] },
    { fields: ['created_at'] }
  ]
});

  // Instance methods
Comment.prototype.addLike = async function() {
  this.likes += 1;
  await this.save();
};

Comment.prototype.removeLike = async function() {
  if (this.likes > 0) {
    this.likes -= 1;
    await this.save();
  }
};

Comment.prototype.edit = async function(newContent) {
  // Store the previous version in edit history
  const previousVersion = {
    content: this.content,
    edited_at: this.updated_at
  };

  this.editHistory = [...(this.editHistory || []), previousVersion];
  this.content = newContent;
  await this.save();
};

Comment.prototype.softDelete = async function() {
  this.status = 'deleted';
  await this.save();
};

Comment.prototype.hide = async function() {
  this.status = 'hidden';
  await this.save();
};

Comment.prototype.restore = async function() {
  this.status = 'active';
  await this.save();
};

// Static methods
Comment.findWithDetails = async function(options = {}) {
  return Comment.findAll({
    ...options,
    include: [
      {
        association: 'author',
        attributes: ['id', 'username', 'displayName', 'avatar']
      },
      {
        association: 'replies',
        include: [
          {
            association: 'author',
            attributes: ['id', 'username', 'displayName', 'avatar']
          }
        ]
      }
    ]
  });
  };

  // Define associations in a function to be called after all models are defined
  Comment.associate = (models) => {
    Comment.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'author'
    });

    Comment.belongsTo(models.Post, {
      foreignKey: 'post_id'
    });

    Comment.belongsTo(Comment, {
      foreignKey: 'parent_id',
      as: 'parent'
    });

    Comment.hasMany(Comment, {
      foreignKey: 'parent_id',
      as: 'replies'
    });
  };

  return Comment;
};