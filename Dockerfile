FROM node:24.14.1-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.14.1-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/main"]
