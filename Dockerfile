FROM node:22-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

COPY package.json npm-shrinkwrap.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]