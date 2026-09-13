FROM node:24.20.0-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/exercises/package.json packages/exercises/package.json
COPY packages/shop-domain/package.json packages/shop-domain/package.json
COPY packages/test-data/package.json packages/test-data/package.json
RUN npm ci --ignore-scripts

COPY . .
RUN npx esbuild@0.25.12 apps/api/src/index.ts --bundle --platform=node --format=cjs --external:pg --outfile=/tmp/api.cjs

FROM node:24.20.0-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/exercises/package.json packages/exercises/package.json
COPY packages/shop-domain/package.json packages/shop-domain/package.json
COPY packages/test-data/package.json packages/test-data/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /tmp/api.cjs ./api.cjs
COPY apps/api/drizzle /drizzle
ENV APP_MODE=test
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3000
CMD ["node", "api.cjs"]
