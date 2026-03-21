# THOUESA Logistics Platform

## Overview
THOUESA is a logistics and shipping platform between Algeria and Jordan. This project uses Node.js, Express, and MySQL.

## Prerequisites
- Node.js 18+
- MySQL 8.0+

## Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and fill in the required values.
4. Ensure the MySQL database is running and accessible.

## Scripts
- `npm run dev`: Start the development server with nodemon.
- `npm start`: Start the production server.
- `npm run build`: Run diagnostic checks and linting.
- `npm run lint`: Run ESLint to check for code issues.
- `npm run doctor`: Run system diagnostics to ensure environment is configured correctly.
- `npm run seed:admin`: Create the default admin user based on `.env` credentials.

## Deployment
1. Set `NODE_ENV=production` in your environment.
2. Run `npm run build` to verify the environment.
3. Run `npm start` to start the application.

## Security
- The application uses JWT for authentication with refresh token rotation.
- CSRF protection is enabled for state-changing API routes.
- Rate limiting is applied to authentication endpoints.
- Uploaded files are protected and require authentication to access.
