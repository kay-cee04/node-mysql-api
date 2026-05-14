import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export default async function sendEmail({ to, subject, html, from }: any) {
    let transporterConfig;
    
    if (process.env.NODE_ENV === 'production') {
        // Production - use environment variables
        transporterConfig = {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };
    } else {
        // Development - use config.json
        const config = require('../config.json');
        transporterConfig = config.smtpOptions;
    }
    
    const transporter = nodemailer.createTransport(transporterConfig);
    const fromEmail = from || process.env.EMAIL_FROM || 'info@node-mysql-api.com';
    
    await transporter.sendMail({ from: fromEmail, to, subject, html });
}