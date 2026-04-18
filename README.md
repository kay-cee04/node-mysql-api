# Node.js, TypeScript & MySQL Authentication API

## What This Activity Does

This project is a complete authentication API built with Node.js, TypeScript, and MySQL. It allows users to register, verify their email, login, and manage their accounts with secure JWT tokens.

## Main Features

- User Registration with Email Verification
- Login with JWT Access Tokens
- Refresh Token stored in HTTP-Only Cookie
- Role-Based Access Control (Admin and User roles)
- Forgot Password and Reset Password
- Full CRUD Operations for Accounts
- MySQL Database with Sequelize ORM

## How It Works

1. User registers with name, email, and password
2. System sends verification token to email (via Ethereal)
3. User verifies email to activate account
4. User logs in to receive JWT token
5. JWT token is used for authenticated requests
6. First registered user becomes ADMIN
7. All subsequent users become regular USERS

## Tech Stack

- Node.js - JavaScript runtime
- TypeScript - Type-safe JavaScript
- Express - Web framework
- MySQL - Database
- Sequelize - ORM for MySQL
- JWT - Authentication tokens
- Nodemailer - Email sending
- Ethereal Email - Fake SMTP for testing

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /accounts/register | Create new account |
| POST | /accounts/verify-email | Verify email with token |
| POST | /accounts/authenticate | Login and get JWT token |
| POST | /accounts/refresh-token | Get new JWT token |
| POST | /accounts/revoke-token | Logout / revoke token |
| POST | /accounts/forgot-password | Request password reset |
| POST | /accounts/reset-password | Reset password with token |
| GET | /accounts | Get all accounts (Admin only) |
| GET | /accounts/:id | Get single account |
| POST | /accounts | Create user (Admin only) |
| PUT | /accounts/:id | Update account |
| DELETE | /accounts/:id | Delete account |

## How to Run the Project

### 1. Install Dependencies
```bash
npm install