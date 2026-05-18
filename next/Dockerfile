FROM node:22-alpine

RUN mkdir -p /var/www/next

# timezone
WORKDIR /var/www/next
COPY ./next /var/www/next/

RUN apk add --no-cache \
    bash \
    bind-tools \
    ca-certificates \
    curl \
    git \
    iproute2 \
    iputils \
    mariadb-client \
    netcat-openbsd \
    openssl \
    tini \
    yarn

ENV HOST 0.0.0.0

EXPOSE 3000

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]
