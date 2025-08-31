import { Sequelize } from 'sequelize';
import 'dotenv/config';


// Database configuration
const config = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: false
    },
    dialectOptions: {
      // SSL configuration for Supabase
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      // PgBouncer configuration
      application_name: 'localconnect-backend',
      // Handle PgBouncer transaction mode
      statement_timeout: 60000,
      query_timeout: 60000,
      // Additional connection options for Supabase
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    }
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: (process.env.DB_NAME || 'localconnect') + '_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    },
    dialectOptions: {
      ssl: false
    }
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 60000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      // PgBouncer configuration
      application_name: 'localconnect-backend',
      // Handle PgBouncer transaction mode
      statement_timeout: 60000,
      query_timeout: 60000,
      // Additional connection options for Supabase
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    }
  }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
let sequelize;

if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
  );
}

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
  } catch (error) {
    throw error;
  }
};

export { sequelize, testConnection };
export default config;