# Multi-stage Dockerfile for testing sequelize-version

# Base stage with Node.js
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache postgresql-client

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Test stage
FROM deps AS test
COPY . .
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_USER=postgres
ENV DB_PWD=postgres
ENV DB_TEST=sequelize_version_test

# Wait for postgres and run tests
CMD ["sh", "-c", "until pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; do sleep 1; done && npm run test:coverage"]
