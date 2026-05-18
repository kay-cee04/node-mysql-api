import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import errorHandler from './_middleware/error-handler';
import accountsController from './accounts/accounts.controller';
import swaggerDocs from './_helpers/swagger';

const app = express();

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// API routes
app.use('/accounts', accountsController);

// Swagger documentation
app.use('/api-docs', swaggerDocs);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});