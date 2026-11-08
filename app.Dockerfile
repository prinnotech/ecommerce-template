# The store or the admin (Next.js), for Railway or any Docker host. Build from the repo root:
#   docker build -f app.Dockerfile --build-arg APP=store -t storefront-store .
#   docker build -f app.Dockerfile --build-arg APP=admin -t storefront-admin .
# Railway: set RAILWAY_DOCKERFILE_PATH=app.Dockerfile and APP=store (or admin) on the service.
# Railway passes service variables to the build as build args when they're declared below.
FROM node:24-alpine AS build
WORKDIR /repo

ARG APP=store
# NEXT_PUBLIC_* values are baked into the browser code at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_POCKETBASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Server values the build needs to prerender pages (it falls back to defaults if the backend is
# unreachable from the build).
ARG BACKEND
ARG POCKETBASE_SUPERUSER_EMAIL
ARG POCKETBASE_SUPERUSER_PASSWORD
ARG SUPABASE_SECRET_KEY
ARG DATABASE_URL

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/store/package.json apps/store/
COPY apps/admin/package.json apps/admin/
COPY packages packages
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build -w @repo/${APP}

FROM node:24-alpine
WORKDIR /repo
ARG APP=store
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP=${APP}
COPY --from=build /repo /repo
EXPOSE 3000
# next start reads PORT (Railway sets it).
CMD ["sh", "-c", "npm run start -w @repo/${APP}"]
