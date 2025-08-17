import { Model, DataTypes, Op } from 'sequelize';
import { sequelize } from '../config/database.js';

export default (sequelize, DataTypes) => {
  const Chat = sequelize.define('Chat', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Chat Type
    type: {
      type: DataTypes.ENUM('direct', 'group'),
      allowNull: false
    },
    
    // Participants (stored as JSONB)
    participants: {
      type: DataTypes.JSONB,
      defaultValue: [],
      validate: {
        isValidParticipants(value) {
          if (!Array.isArray(value)) {
            throw new Error('Participants must be an array');
          }
          value.forEach(participant => {
            if (!participant.user || !participant.role) {
              throw new Error('Each participant must have user and role');
            }
          });
        }
      }
    },
    
    // Group Chat Information (only for group chats)
    groupInfo: {
      type: DataTypes.JSONB,
      defaultValue: {},
      validate: {
        isValidGroupInfo(value) {
          if (this.type === 'group' && !value.name) {
            throw new Error('Group chats must have a name');
          }
        }
      }
    },
    
    // Last Message Info (for chat list)
    lastMessage: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    
    // Chat Status
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_archived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Message Count
    message_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    
    // Encryption (for future implementation)
    encryption_jsonb: {
      type: DataTypes.JSONB,
      defaultValue: {
        isEncrypted: false,
        keyId: null
      }
    },
    
    // Moderation
    moderation_jsonb: {
      type: DataTypes.JSONB,
      defaultValue: {
        isReported: false,
        reportCount: 0,
        isReviewed: false,
        reviewedBy: null,
        reviewedAt: null
      }
    }
  }, {
    tableName: 'chats',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['participants'], using: 'gin' },
      { fields: ['type', 'is_active'] },
      { fields: ['updated_at'] },
      { fields: ['is_active'] },
      { fields: ['is_archived'] }
    ]
  });

  // Instance methods
  Chat.prototype.getActiveParticipantsCount = function() {
    return this.participants.filter(p => p.is_active).length;
  };

  Chat.prototype.addParticipant = async function(userId, role = 'member', addedBy = null) {
    const participants = [...this.participants];
    
    // Check if user is already a participant
    const existingParticipantIndex = participants.findIndex(p => 
      p.user === userId.toString()
    );
    
    if (existingParticipantIndex !== -1) {
      if (!participants[existingParticipantIndex].is_active) {
        participants[existingParticipantIndex].is_active = true;
        participants[existingParticipantIndex].joinedAt = new Date();
        participants[existingParticipantIndex].leftAt = null;
      }
    } else {
      participants.push({
        user: userId.toString(),
        role,
        joinedAt: new Date(),
        is_active: true,
        lastReadAt: new Date(),
        notifications_enabled: true
      });
    }
    
    this.participants = participants;
    return this.save();
  };

  Chat.prototype.removeParticipant = async function(userId, removedBy = null) {
    const participants = [...this.participants];
    const participantIndex = participants.findIndex(p => 
      p.user === userId.toString()
    );
    
    if (participantIndex !== -1) {
      participants[participantIndex].is_active = false;
      participants[participantIndex].leftAt = new Date();
    }
    
    this.participants = participants;
    return this.save();
  };

  Chat.prototype.updateParticipantRole = async function(userId, newRole) {
    const participants = [...this.participants];
    const participantIndex = participants.findIndex(p => 
      p.user === userId.toString() && p.is_active
    );
    
    if (participantIndex !== -1) {
      participants[participantIndex].role = newRole;
    }
    
    this.participants = participants;
    return this.save();
  };

  Chat.prototype.isParticipant = function(userId) {
    return this.participants.some(p => 
      p.user === userId.toString() && p.is_active
    );
  };

  Chat.prototype.isAdmin = function(userId) {
    const participant = this.participants.find(p => 
        p.user === userId.toString() && p.is_active
    );
    
    return participant && (participant.role === 'admin' || participant.role === 'owner');
  };

  Chat.prototype.updateLastMessage = async function(messageContent, senderId, messageType = 'text') {
    this.lastMessage = {
      content: messageContent,
      sender: senderId.toString(),
      timestamp: new Date(),
      type: messageType
    };
    
    this.messageCount += 1;
    
    return this.save();
  };

  Chat.prototype.markAsRead = async function(userId) {
    const participants = [...this.participants];
    const participantIndex = participants.findIndex(p => 
      p.user === userId.toString() && p.is_active
    );
    
    if (participantIndex !== -1) {
      participants[participantIndex].lastReadAt = new Date();
    }
    
    this.participants = participants;
    return this.save();
  };

  Chat.prototype.getUnreadCountForUser = async function(userId) {
    const participant = this.participants.find(p => 
      p.user === userId.toString() && p.is_active
    );
    
    if (!participant) return 0;
    
    const Message = sequelize.models.Message;
    return await Message.count({
      where: {
        chatId: this.id,
        createdAt: { [Op.gt]: participant.lastReadAt },
        senderId: { [Op.ne]: userId }
      }
    });
  };

  Chat.prototype.toggleArchive = async function() {
    this.is_archived = !this.is_archived;
    return this.save();
  };

  // Static methods
  Chat.findDirectChat = async function(user1Id, user2Id) {
    return this.findOne({
      where: {
        type: 'direct',
        participants: {
          [Op.contains]: [
            { user: user1Id.toString(), is_active: true },
            { user: user2Id.toString(), is_active: true }
          ]
        }
      },
      include: [{
        model: sequelize.models.User,
        as: 'participantUsers',
        attributes: ['id', 'displayName', 'username', 'avatarUrl']
      }]
    });
  };

  Chat.getUserChats = async function(userId, options = {}) {
    const where = {
      participants: {
        [Op.contains]: [{ user: userId.toString(), is_active: true }]
      },
      is_active: true
    };
    
    if (options.type) where.type = options.type;
    if (options.archived !== undefined) where.is_archived = options.archived;
    
    return this.findAll({
      where,
      include: [{
        model: sequelize.models.User,
        as: 'participantUsers',
        attributes: ['id', 'displayName', 'username', 'avatarUrl', 'lastActive']
      }],
      order: [
        [sequelize.literal("lastMessage->>'timestamp'"), 'DESC'],
        ['updatedAt', 'DESC']
      ]
    });
  };

  Chat.createDirectChat = async function(user1Id, user2Id) {
    return this.create({
      type: 'direct',
      participants: [
        { 
          user: user1Id.toString(), 
          role: 'member',
          joinedAt: new Date(),
          is_active: true,
          lastReadAt: new Date(),
          notifications_enabled: true
        },
        { 
          user: user2Id.toString(), 
          role: 'member',
          joinedAt: new Date(),
          is_active: true,
          lastReadAt: new Date(),
          notifications_enabled: true
        }
      ]
    });
  };

  Chat.createGroupChat = async function(creatorId, name, description, participantIds = []) {
    const participants = [
      { 
        user: creatorId.toString(), 
        role: 'owner',
        joinedAt: new Date(),
        is_active: true,
        lastReadAt: new Date(),
        notifications_enabled: true
      }
    ];
    
    // Add other participants as members
    participantIds.forEach(userId => {
      if (userId.toString() !== creatorId.toString()) {
        participants.push({ 
          user: userId.toString(), 
          role: 'member',
          joinedAt: new Date(),
            is_active: true,
          lastReadAt: new Date(),
          notifications_enabled: true
        });
      }
    });
    
    return this.create({
      type: 'group',
      participants,
      groupInfo: {
        name,
        description,
        settings: {
          only_admins_can_message: false,
          only_admins_can_add_members: false,
          only_admins_can_edit_info: true,
          disappearing_messages: {
            enabled: false,
            duration: 24,
            expires_at: null
          }
        }
      }
    });
  };

  return Chat;
};