FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/
COPY admin-ui/ ./admin-ui/

# Build the application
RUN npm run build

# Expose port
EXPOSE 3300

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

USER nextjs

# Start the application
CMD ["npm", "start"]
