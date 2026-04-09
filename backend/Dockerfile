# -------- deps --------
FROM node:22-alpine3.22 AS deps
WORKDIR /app

# Prisma en Alpine suele necesitar openssl
RUN apk update && apk upgrade --no-cache && apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

# -------- build --------
FROM node:22-alpine3.22 AS build
WORKDIR /app
RUN apk update && apk upgrade --no-cache && apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera el cliente de Prisma
RUN npx prisma generate

# Si tienes build (TS), descomenta:
# RUN npm run build

# -------- runtime --------
FROM node:22-alpine3.22 AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk update && apk upgrade --no-cache && apk add --no-cache openssl

# Copiamos app
COPY --from=build /app ./

# Seguridad: correr como usuario no-root
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

# IMPORTANTE:
# Si tu start real es distinto (ej: node backend/src/index.js), cámbialo.
CMD ["npm","start"]