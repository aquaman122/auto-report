FROM node:18-alpine

WORKDIR /app

# 시스템 의존성 설치 (Wiki용 도구 포함)
RUN apk add --no-cache \
  ffmpeg \
  python3 \
  make \
  g++ \
  curl \
  git

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --production && npm cache clean --force

# 소스 코드 복사
COPY src/ ./src/

# 디렉토리 생성
RUN mkdir -p uploads summaries logs

# 사용자 설정
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]