FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render/Railway 등은 PORT 환경변수를 주입합니다. 없으면 8000.
ENV PORT=8000
EXPOSE 8000

CMD ["python", "-m", "sector_news_agent.web"]
