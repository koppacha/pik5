COMPOSE=docker compose
COMPOSE_PROD=docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: up down ps logs logs-next logs-laravel logs-mysql \
        bash-next bash-laravel bash-mysql \
        dev-next build-next \
        prod-up prod-down prod-restart prod-ps \
        prod-logs prod-logs-next prod-logs-laravel prod-logs-mysql

# ----------------------
# 開発用
# ----------------------

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f

logs-next:
	$(COMPOSE) logs -f next

logs-laravel:
	$(COMPOSE) logs -f laravel

logs-mysql:
	$(COMPOSE) logs -f mysql

bash-next:
	$(COMPOSE) exec next bash

bash-laravel:
	$(COMPOSE) exec laravel bash

bash-mysql:
	$(COMPOSE) exec mysql bash

dev-next:
	$(COMPOSE) exec next yarn dev

build-next:
	$(COMPOSE) exec next yarn build

# ----------------------
# 本番用
# ----------------------

prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-restart:
	$(COMPOSE_PROD) restart

prod-ps:
	$(COMPOSE_PROD) ps

prod-logs:
	$(COMPOSE_PROD) logs -f

prod-logs-next:
	$(COMPOSE_PROD) logs -f next

prod-logs-laravel:
	$(COMPOSE_PROD) logs -f laravel

prod-logs-mysql:
	$(COMPOSE_PROD) logs -f mysql