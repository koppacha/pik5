FROM node:18.17.0-alpine

RUN mkdir -p /var/www/next

# timezone
WORKDIR /var/www/next
COPY ./next /var/www/next/

RUN apk update && \
    apk add git curl bash vim yarn

ENV HOST 0.0.0.0

EXPOSE 3000
