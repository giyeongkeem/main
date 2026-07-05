FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY anbu_api ./anbu_api

# 운영 기본값 — 데모가 아닌 배포에서는 인증을 강제한다
ENV ANBU_REQUIRE_AUTH=1 \
    ANBU_DB=/data/anbu.db

VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "anbu_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
