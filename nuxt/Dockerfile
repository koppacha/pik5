FROM node:18.12.0-alpine

RUN mkdir -p /var/www/nuxt

# timezone
WORKDIR /var/www/nuxt
COPY ./nuxt /var/www/nuxt/

RUN apk update && \
    apk add git curl bash vim

ENV HOST 0.0.0.0

EXPOSE 3000

#ENTRYPOINT ["yarn", "run", "dev"]
