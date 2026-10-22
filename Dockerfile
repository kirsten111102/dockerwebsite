
# Use Node.js Alpine as the base image
FROM node:24-alpine

# Set the working directory
WORKDIR /app

# Install dependencies first for better build caching
COPY package*.json ./

RUN npm ci --omit=dev

# Copy the application source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Your Express application listens on port 3000
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
