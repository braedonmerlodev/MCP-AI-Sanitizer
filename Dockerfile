FROM node:22-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

COPY package.json npm-shrinkwrap.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

# Support for CLI mode
ARG MODE=api
ENV MODE=${MODE}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD if [ "$MODE" = "api" ]; then curl -f http://localhost:3000/health || exit 1; else exit 0; fi

CMD if [ "$MODE" = "cli" ]; then node tools/cli.js; else npm start; fi