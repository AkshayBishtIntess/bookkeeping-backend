# Book-Keeping Backend

This is the backend for the Book-Keeping application, built with Node.js, Sequelize, and PostgreSQL. The backend supports functionality like OCR processing, S3 bucket integration, and database management.

---

## Environment Setup

### 1. Add the `.env` File

Create a `.env` file in the root directory of the project and add the following environment variables:

```env
# Environment
NODE_ENV=dev

# AWS S3 Configuration
S3_BUCKET_OCR=*
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=*
AWS_SECRET_ACCESS_KEY=*

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public

# Dev Database Details
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=book-keeping-dev
DB_HOST=127.0.0.1
DB_PORT=5432

# API Keys
ANTHROPIC_API_KEY=*

# Server Configuration
PORT=8000

# PDF Base URL
PDF_BASE_URL=http://localhost
```

### 2. Install the packages
```
npm install
```

### 3. To Run the backend
```
node index.js
```


