FROM php:8.2-fpm-bullseye
SHELL ["/bin/bash", "-oeux", "pipefail", "-c"]

# timezone environment
ENV TZ=UTC \
  # locale
  LANG=en_US.UTF-8 \
  LANGUAGE=en_US:en \
  LC_ALL=en_US.UTF-8 \
  # composer environment
  COMPOSER_ALLOW_SUPERUSER=1 \
  COMPOSER_HOME=/composer

COPY --from=composer:2.2 /usr/bin/composer /usr/bin/composer

RUN apt-get update && \
  apt-get -y install sudo git libicu-dev libonig-dev libzip-dev unzip locales nodejs npm && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/* && \
  locale-gen en_US.UTF-8 && \
  localedef -f UTF-8 -i en_US en_US.UTF-8 && \
  mkdir /var/run/php-fpm && \
  docker-php-ext-install intl pdo_mysql zip bcmath && \
  composer config -g process-timeout 3600 && \
  composer config -g repos.packagist composer https://packagist.org

COPY ./laravel/php/zzz-www.conf /usr/local/etc/php-fpm.d/zzz-www.conf
COPY ./laravel/php/php.ini /usr/local/etc/php/php.ini

WORKDIR /var/www/laravel/

# Install Laravel Telescope at build time if a project is present
RUN if [ -f composer.json ]; then \
      composer require laravel/telescope --no-interaction --prefer-dist && \
      ( [ -f artisan ] && php artisan telescope:install || true ); \
    else \
      echo "composer.json not found; skipping telescope install"; \
    fi

CMD ["php","artisan","serve","--host","0.0.0.0"]
