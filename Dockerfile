# ---- Build client ----
FROM node:22-bookworm-slim AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY client client
RUN npm run build -w client

# ---- Build server ----
FROM node:22-bookworm-slim AS server-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY server server
RUN npm run build -w server

# ---- Production deps only ----
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev --workspace server

# ---- Runtime ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/app/server/drizzle
ENV EXERCISE_DB_DIR=/app/server/exercise-db
WORKDIR /app
COPY --from=prod-deps /app/node_modules node_modules
COPY --from=server-build /app/server/dist server/dist
COPY server/drizzle server/drizzle
COPY server/exercise-db server/exercise-db
COPY --from=client-build /app/client/dist server/dist/public
EXPOSE 3420
VOLUME /data
CMD ["node", "server/dist/index.js"]
