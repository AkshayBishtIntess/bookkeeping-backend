ADD THIS .env file at root of your folder
-----------------------------------------

NODE_ENV=dev
S3_BUCKET_OCR = 'book-keeping-bucket'
AWS_REGION = 'us-east-1'
AWS_ACCESS_KEY_ID = 'AKIA4HWJUAI2FVTU2SEQ'
AWS_SECRET_ACCESS_KEY = 'pppEf/t8tdh6XZhe5bSHjI8AhQ/JaAl3A559C18H'
DATABASE_URL ='postgresql://postgres:postgres@localhost:5432/postgres?schema=public'


ANTHROPIC_API_KEY=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
PORT=8000

# DATABASE CONFIGURATION FOR DEV ENVIRONMENT
NODE_ENV='development'
DB_USERNAME='postgres'
DB_PASSWORD='postgres'
DB_NAME='book-keeping-dev'
DB_HOST='127.0.0.1'
DB_PORT='5432'
PDF_BASE_URL=http://localhost
