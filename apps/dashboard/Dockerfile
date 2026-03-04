# ── Stage 1: Build ───────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY apps/dashboard/package.json apps/dashboard/package-lock.json* ./
RUN npm install --prefer-offline 2>/dev/null || npm install

COPY apps/dashboard/ .
# Skip tsc -b in Docker; Vite handles TS via esbuild
RUN npx vite build

# ── Stage 2: Serve ───────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;\n\
    gzip_min_length 256;\n\
    location /assets/ { expires 30d; add_header Cache-Control "public, immutable"; }\n\
    location / { try_files $uri $uri/ /index.html; }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
