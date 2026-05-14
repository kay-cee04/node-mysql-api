import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

import accountModel from '../accounts/account.model';
import refreshTokenModel from '../accounts/refresh-token.model';

const db: any = {};

export default db;

async function initialize() {
    let host, port, user, password, database;
    
    if (process.env.NODE_ENV === 'production') {
        // Production - use environment variables
        host = process.env.DB_HOST;
        port = parseInt(process.env.DB_PORT || '3306');
        user = process.env.DB_USER;
        password = process.env.DB_PASSWORD;
        database = process.env.DB_NAME;
    } else {
        // Development - use config.json
        const config = require('../config.json');
        host = config.database.host;
        port = config.database.port;
        user = config.database.user;
        password = config.database.password;
        database = config.database.database;
    }

    // Create database if it doesn't exist
    const connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    
    // Connect to database
    const sequelize = new Sequelize(database, user, password, { dialect: 'mysql' });
    
    // Initialize models
    db.Account = accountModel(sequelize);
    db.RefreshToken = refreshTokenModel(sequelize);
    
    // Define relationships
    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);
    
    // Sync models with database
    await sequelize.sync();
    
    console.log('Database connected and models synchronized');
}

initialize();