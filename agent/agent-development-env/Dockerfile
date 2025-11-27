# Agent Development Container - Python with deepagent package
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    bash \
    vim \
    jq \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
WORKDIR /app

# Copy requirements file for Python dependencies
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Create non-root user for security
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port for local development server
EXPOSE 3000

# Health check - check if Python can import deepagent
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "from deepagent import Agent; print('deepagent package ready')" || exit 1

# Default command - keep container running for development
CMD ["tail", "-f", "/dev/null"]