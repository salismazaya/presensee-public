.PHONY: migrate runserver makemigrations test test-e2e

runserver:
	uv run python manage.py runserver

migrate:
	uv run python manage.py migrate

makemigrations:
	uv run python manage.py makemigrations

test:
	uv run python manage.py test main.tests --exclude-tag=e2e

test-e2e:
	uv run python manage.py test main.tests.test_e2e_frontend
