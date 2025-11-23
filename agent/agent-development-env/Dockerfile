# Agent Development Container
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    vim \
    jq \
    && rm -rf /var/cache/apk/*

# Install Deep Agent CLI globally
RUN npm install -g deep-agent-cli

# Create workspace directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install Node.js dependencies if any
RUN npm install || true

# Copy project files
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Change ownership of workspace
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port for local development server
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command - keep container running for development
CMD ["tail", "-f", "/dev/null"]