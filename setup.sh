#!/bin/zsh

docker compose exec laravel php artisan serve --host 0.0.0.0
docker compose exec next yarn start
