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
        
        // PRODUCTION (Railway) - use environment variables only
        if (process.env.NODE_ENV === 'production') {
            host = process.env.DB_HOST || '';
            port = parseInt(process.env.DB_PORT || '3306');
            user = process.env.DB_USER || '';
            password = process.env.DB_PASSWORD || '';
            database = process.env.DB_NAME || '';
            
            console.log(`🔵 Production mode - connecting to ${host}:${port}`);
            
            if (!host || !user || !database) {
                throw new Error('Missing database environment variables');
            }
        } else {
            // DEVELOPMENT - only use config.json in development
            try {
                const config = require('../config.json');
                host = config.database.host;
                port = config.database.port;
                user = config.database.user;
                password = config.database.password;
                database = config.database.database;
                console.log(`🟢 Development mode - connecting to ${host}:${port}`);
            } catch (err: any) {
                console.error('config.json not found for local development');
                throw err;
            }
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
        console.log('✅ Database connection established');
        
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
        console.error('❌ Database error:', error);
        throw error;
    }
}

// Initialize database
initialize().catch(error => {
    console.error('Failed to initialize database:', error.message);
});