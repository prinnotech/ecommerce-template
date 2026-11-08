# PocketBase service for Railway (or any Docker host).
# Railway: set RAILWAY_DOCKERFILE_PATH=pocketbase.Dockerfile and mount a volume at /pb/pb_data.
# Only the schema ships (pb_migrations, pb_hooks); the database lives in the volume.
FROM alpine:3.22

ARG PB_VERSION=0.40.6
ARG TARGETARCH=amd64

RUN apk add --no-cache ca-certificates unzip wget \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
  && unzip /tmp/pb.zip -d /pb \
  && rm /tmp/pb.zip

COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks

EXPOSE 8090

# Railway provides PORT; elsewhere it defaults to 8090. Migrations apply on start, and
# pb_migrations/1793059208_bootstrap_admins.js creates the superuser and store admin from env.
CMD ["sh", "-c", "/pb/pocketbase serve --http=0.0.0.0:${PORT:-8090} --dir=/pb/pb_data --migrationsDir=/pb/pb_migrations --hooksDir=/pb/pb_hooks"]
