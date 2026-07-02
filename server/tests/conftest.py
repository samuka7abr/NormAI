import os

os.environ.setdefault("TESTING", "1")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/normalizador")
os.environ.setdefault("AWS_S3_ENDPOINT_URL", "http://localhost:4566")
