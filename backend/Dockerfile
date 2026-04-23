# Use lightweight Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy only package files first
COPY package*.json ./

# Install ONLY production deps
RUN npm ci --only=production

# Copy source code
COPY . .

# Set environment
ENV NODE_ENV=production

# Expose correct port
EXPOSE 1000

# Run app (NO nodemon)
CMD ["node", "server.js"]