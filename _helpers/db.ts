import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

import accountModel from '../accounts/account.model';
import refreshTokenModel from '../accounts/refresh-token.model';

const db: any = {};

export default db;

async function initialize() {
    try {
        let host: string, port: number, user: string, password: string, database: string;
        
        // ONLY check NODE_ENV for production detection (NOT DB_HOST)
        if (process.env.NODE_ENV === 'production') {
            // PRODUCTION (Railway) - use environment variables
            host = process.env.DB_HOST || '';
            port = parseInt(process.env.DB_PORT || '3306');
            user = process.env.DB_USER || '';
            password = process.env.DB_PASSWORD || '';
            database = process.env.DB_NAME || '';
            
            console.log(`🔵 Connecting to production database at ${host}:${port}`);
        } else {
            // DEVELOPMENT (Local) - use config.json
            const config = require('../config.json');
            host = config.database.host;
            port = config.database.port;
            user = config.database.user;
            password = config.database.password;
            database = config.database.database;
            
            console.log(`🟢 Connecting to development database at ${host}:${port}`);
        }

        // Validate required variables
        if (!host || !user || !database) {
            console.error('Missing configuration:', { host, user, database });
            throw new Error('Missing database configuration');
        }

        // Create database if it doesn't exist
        const connection = await mysql.createConnection({ host, port, user, password });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
        await connection.end();
        
        // Connect with Sequelize
        const sequelize = new Sequelize(database, user, password, { 
            dialect: 'mysql',
            host: host,
            port: port,
            logging: false,
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            }
        });
        
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully.');
        
        // Initialize models
        db.Account = accountModel(sequelize);
        db.RefreshToken = refreshTokenModel(sequelize);
        
        // Define relationships
        db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
        db.RefreshToken.belongsTo(db.Account);
        
        await sequelize.sync({ alter: false });
        console.log('✅ Database models synchronized');
        
        db.sequelize = sequelize;
        db.Sequelize = Sequelize;
        
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

initialize().catch(error => {
    console.error('Failed to initialize database:', error.message);
});