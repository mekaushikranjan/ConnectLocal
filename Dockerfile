# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install dependencies using the new syntax
RUN npm ci --omit=dev --silent

# Copy source code
COPY . .

# Create startup script
COPY start.js ./

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-deprecation"

# Start the application
CMD ["npm", "start"]
