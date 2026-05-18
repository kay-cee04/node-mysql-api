import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export default async function sendEmail({ to, subject, html, from = process.env.EMAIL_FROM }: any) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    await transporter.sendMail({ from, to, subject, html });
}