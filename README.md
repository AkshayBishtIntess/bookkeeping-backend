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
AWS_REGION=*
AWS_ACCESS_KEY_ID=*
AWS_SECRET_ACCESS_KEY=*

# Database Configuration
DATABASE_URL=*

# Dev Database Details
DB_USERNAME=*
DB_PASSWORD=*
DB_NAME=*
DB_HOST=*
DB_PORT=*

# API Keys
ANTHROPIC_API_KEY=*

# Server Configuration
PORT=*

# PDF Base URL
PDF_BASE_URL=*
```

### 2. Install the packages
```
npm install
```

### 3. To Run the backend
```
node index.js
```


