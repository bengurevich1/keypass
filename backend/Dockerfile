FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

# Push schema and seed on startup, then start server
CMD sh -c "npx drizzle-kit push && node dist/db/seed.js; node dist/index.js"
