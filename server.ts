import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import errorHandler from './_middleware/error-handler';
import accountsController from './accounts/accounts.controller';
import swaggerDocs from './_helpers/swagger';

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
app.use(cors({ 
    origin: corsOrigin, 
    credentials: true 
}));

app.use('/accounts', accountsController);
app.use('/api-docs', swaggerDocs);
app.use(errorHandler);

const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});