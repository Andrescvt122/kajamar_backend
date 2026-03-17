# -------- deps --------
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma en Alpine suele necesitar openssl
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

# -------- build --------
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Genera el cliente de Prisma
RUN npx prisma generate

# Si tienes build (TS), descomenta:
# RUN npm run build

# -------- runtime --------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

# Copiamos app
COPY --from=build /app ./

# Seguridad: correr como usuario no-root
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

# IMPORTANTE:
# Si tu start real es distinto (ej: node backend/src/index.js), cámbialo.
CMD ["npm","start"]