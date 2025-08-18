import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';


// Import all models in dependency order

// Import models that use function pattern (need to be called)
import UserModel from './User.js';
import PostModel from './Post.js';
import CommentModel from './Comment.js';
import JobModel from './Job.js';
import JobApplicationModel from './JobApplication.js';
import MarketplaceItemModel from './MarketplaceItem.js';
import ChatModel from './Chat.js';
import MessageModel from './Message.js';
import ReportModel from './Report.js';
import ConnectionModel from './Connection.js';
import SupportTicketModel from './SupportTicket.js';
import LiveChatModel from './LiveChat.js';
import LiveChatMessageModel from './LiveChatMessage.js';

// Import privacy and safety models (function pattern)
import PrivacySettingsModel from './PrivacySettings.js';
import TwoFactorAuthModel from './TwoFactorAuth.js';
import BlockedUserModel from './BlockedUser.js';
import EmergencyContactModel from './EmergencyContact.js';
import RecoverySettingsModel from './RecoverySettings.js';
import LoginHistoryModel from './LoginHistory.js';

// Import location models (function pattern)
import LocationSettingsModel from './LocationSettings.js';
import LocationHistoryModel from './LocationHistory.js';

// Import models that depend on others last (function pattern)
import NotificationModel from './Notification.js';
import ModerationLogModel from './ModerationLog.js';

// Import models that use direct pattern (already instantiated)
import Group from './Group.js';
import GroupMember from './GroupMember.js';

// Instantiate function pattern models
const User = UserModel(sequelize, DataTypes);
const Post = PostModel(sequelize);
const Comment = CommentModel(sequelize);
const Job = JobModel(sequelize);
const JobApplication = JobApplicationModel(sequelize, DataTypes);
const MarketplaceItem = MarketplaceItemModel(sequelize, DataTypes);
const Chat = ChatModel(sequelize, DataTypes);
const Message = MessageModel(sequelize, DataTypes);
const Report = ReportModel(sequelize);
const Connection = ConnectionModel(sequelize, DataTypes);
const Notification = NotificationModel(sequelize);
const SupportTicket = SupportTicketModel(sequelize, DataTypes);
const LiveChat = LiveChatModel(sequelize, DataTypes);
const LiveChatMessage = LiveChatMessageModel(sequelize, DataTypes);

// Privacy and safety models
const PrivacySettings = PrivacySettingsModel(sequelize, DataTypes);
const TwoFactorAuth = TwoFactorAuthModel(sequelize, DataTypes);
const BlockedUser = BlockedUserModel(sequelize, DataTypes);
const EmergencyContact = EmergencyContactModel(sequelize, DataTypes);
const RecoverySettings = RecoverySettingsModel(sequelize, DataTypes);
const LoginHistory = LoginHistoryModel(sequelize, DataTypes);

// Location models
const LocationSettings = LocationSettingsModel(sequelize, DataTypes);
const LocationHistory = LocationHistoryModel(sequelize, DataTypes);

// Moderation model
const ModerationLog = ModerationLogModel(sequelize);

// Define association
const defineAssociations = () => {
  // User associations
  User.hasMany(Post, { foreignKey: 'author_id', as: 'posts' });
  User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' });
  User.hasMany(Job, { foreignKey: 'posted_by_id', as: 'jobsPosted' });
  User.hasMany(JobApplication, { foreignKey: 'applicant_id', as: 'jobApplications' });
  User.hasMany(MarketplaceItem, { foreignKey: 'seller_id', as: 'marketplaceItems' });
  User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });
  User.hasMany(Report, { foreignKey: 'reporter_id', as: 'reportsSubmitted' });
  User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'supportTickets' });
  User.hasMany(LiveChat, { foreignKey: 'user_id', as: 'liveChats' });
  User.hasMany(LiveChat, { foreignKey: 'admin_id', as: 'adminChats' });
  User.hasMany(LiveChatMessage, { foreignKey: 'sender_id', as: 'liveChatMessages' });
  // Group associations
  User.hasMany(Group, { foreignKey: 'created_by', as: 'createdGroups' });
  User.hasMany(GroupMember, { foreignKey: 'user_id', as: 'groupMemberships' });
  User.hasMany(GroupMember, { foreignKey: 'invited_by', as: 'groupInvitesSent' });
  
  Group.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
  Group.hasMany(GroupMember, { foreignKey: 'group_id', as: 'members' });
  
  GroupMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  GroupMember.belongsTo(Group, { foreignKey: 'group_id', as: 'group' });
  GroupMember.belongsTo(User, { foreignKey: 'invited_by', as: 'invitedByUser' });
  
  // Connection associations
  User.hasMany(Connection, { foreignKey: 'user_id1', as: 'connectionsAsUser1' });
  User.hasMany(Connection, { foreignKey: 'user_id2', as: 'connectionsAsUser2' });
  Connection.belongsTo(User, { foreignKey: 'user_id1', as: 'user1' });
  Connection.belongsTo(User, { foreignKey: 'user_id2', as: 'user2' });

  // Post associations
  Post.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
  Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });
  Post.hasMany(Report, { foreignKey: 'reported_item_id', as: 'reports' });
  Post.hasMany(Notification, { foreignKey: 'post_id' });

  // Comment associations
  Comment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
  Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
  Comment.belongsTo(Comment, { foreignKey: 'parent_id', as: 'parent' });
  Comment.hasMany(Comment, { foreignKey: 'parent_id', as: 'replies' });
  Comment.hasMany(Notification, { foreignKey: 'comment_id' });

  // Job associations
  Job.belongsTo(User, { foreignKey: 'posted_by_id', as: 'postedBy' });
  Job.hasMany(JobApplication, { foreignKey: 'job_id', as: 'applications' });
  Job.hasMany(Notification, { foreignKey: 'job_id' });

  // JobApplication associations
  JobApplication.belongsTo(User, { foreignKey: 'applicant_id', as: 'applicant' });
  JobApplication.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
  JobApplication.hasMany(Notification, { foreignKey: 'application_id' });

  // MarketplaceItem associations
  MarketplaceItem.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });
  MarketplaceItem.hasMany(Notification, { foreignKey: 'marketplace_item_id' });

  // Chat associations
  // Note: Chat uses participants JSONB field, not a through table
  // The association is handled manually in the routes
  Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'messages' });
  Chat.hasMany(Notification, { foreignKey: 'chat_id' });

  // LiveChat associations
  LiveChat.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  LiveChat.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });
  LiveChat.hasMany(LiveChatMessage, { foreignKey: 'session_id', as: 'messages' });

  // LiveChatMessage associations
  LiveChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
  LiveChatMessage.belongsTo(LiveChat, { foreignKey: 'session_id', as: 'session' });

  // Message associations
  Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
  Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
  Message.hasMany(Notification, { foreignKey: 'message_id' });

  // Notification associations - add all the foreign key references
  Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
  Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
  Notification.belongsTo(Post, { foreignKey: 'post_id' });
  Notification.belongsTo(Comment, { foreignKey: 'comment_id' });
  Notification.belongsTo(Job, { foreignKey: 'job_id' });
  Notification.belongsTo(JobApplication, { foreignKey: 'application_id' });
  Notification.belongsTo(MarketplaceItem, { foreignKey: 'marketplace_item_id' });
  Notification.belongsTo(Chat, { foreignKey: 'chat_id' });
  Notification.belongsTo(Message, { foreignKey: 'message_id' });

  // Report associations
  Report.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });

  // SupportTicket associations
  SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Privacy and safety associations
  User.hasOne(PrivacySettings, { foreignKey: 'user_id', as: 'privacySettings' });
  User.hasOne(TwoFactorAuth, { foreignKey: 'user_id', as: 'twoFactorAuth' });
  User.hasMany(BlockedUser, { foreignKey: 'blocker_id', as: 'blockedUsers' });
  User.hasMany(EmergencyContact, { foreignKey: 'user_id', as: 'emergencyContacts' });
  User.hasOne(RecoverySettings, { foreignKey: 'user_id', as: 'recoverySettings' });
  User.hasMany(LoginHistory, { foreignKey: 'user_id', as: 'loginHistory' });

  // Location associations
  User.hasOne(LocationSettings, { foreignKey: 'user_id', as: 'locationSettings' });
  User.hasMany(LocationHistory, { foreignKey: 'user_id', as: 'locationHistory' });

  // Privacy and safety model associations
  PrivacySettings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  TwoFactorAuth.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  BlockedUser.belongsTo(User, { foreignKey: 'blocker_id', as: 'blocker' });
  BlockedUser.belongsTo(User, { foreignKey: 'blocked_id', as: 'blocked' });
  EmergencyContact.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  RecoverySettings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  LoginHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  // Location model associations
  LocationSettings.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  LocationHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
};

// Initialize associations
defineAssociations();

// Database sync function
const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force, alter: !force });
  } catch (error) {
    throw error;
  }
};

// Export models and utilities
export {
  sequelize,
  User,
  Post,
  Comment,
  Job,
  JobApplication,
  MarketplaceItem,
  Chat,
  Message,
  Connection,
  Group,
  GroupMember,
  Notification,
  Report,
  SupportTicket,
  LiveChat,
  LiveChatMessage,
  PrivacySettings,
  TwoFactorAuth,
  BlockedUser,
  EmergencyContact,
  RecoverySettings,
  LoginHistory,
  LocationSettings,
  LocationHistory,
  ModerationLog,
  syncDatabase
};

export default {
  sequelize,
  User,
  Post,
  Comment,
  Job,
  JobApplication,
  MarketplaceItem,
  Chat,
  Message,
  Connection,
  Group,
  GroupMember,
  Notification,
  Report,
  SupportTicket,
  LiveChat,
  LiveChatMessage,
  PrivacySettings,
  TwoFactorAuth,
  BlockedUser,
  EmergencyContact,
  RecoverySettings,
  LoginHistory,
  LocationSettings,
  LocationHistory,
  ModerationLog,
  syncDatabase
};