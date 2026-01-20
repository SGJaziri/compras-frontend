# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# VITE_* se leen en build; Railway pasará VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.25-alpine
ENV PORT=80
RUN apk add --no-cache bash
# usaremos plantilla para escuchar en $PORT
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["bash","-lc","envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
