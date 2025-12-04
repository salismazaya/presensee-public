### ---- Stage 1: Build Frontend ----
FROM oven/bun:latest AS builder

WORKDIR /app

COPY frontend/package.json frontend/bun.lock ./
RUN bun install

COPY frontend/ ./
RUN bun run build


### ---- Stage 2: Backend ----
FROM surnet/alpine-wkhtmltopdf:3.22.0-024b2b2-small

WORKDIR /app

# Copy metadata project
COPY pyproject.toml .
COPY .python-version .
COPY uv.lock .

# Install dependencies
RUN apk update && apk add --no-cache libxrender fontconfig curl git

# Install uv (Python package manager)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Pastikan uv tersedia secara global
ENV PATH="/root/.local/bin:${PATH}"

# Sinkronisasi environment
RUN uv sync

# Copy project
COPY . .

# Django collectstatic
RUN uv run manage.py collectstatic --no-input

# Copy hasil build frontend
COPY --from=builder /app/dist ./frontend/dist

# Default command
ENTRYPOINT ["/bin/sh"]

CMD ["./run.sh"]
