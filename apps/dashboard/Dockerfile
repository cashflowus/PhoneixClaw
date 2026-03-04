FROM node:20-alpine AS build

WORKDIR /app

COPY apps/dashboard/package.json apps/dashboard/package-lock.json* ./
RUN npm ci

COPY apps/dashboard/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/dist/index.html /usr/share/nginx/html/index.html

RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
