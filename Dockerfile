FROM node:24-slim AS docs

# Update and install security patches
RUN apt-get update && apt-get upgrade -y && apt-get clean

WORKDIR /app

COPY . .

RUN rm -f package-lock.json \
  && npm install \
  && npm run docs:build

EXPOSE 3060

CMD ["npx", "serve", ".vitepress/dist", "-p", "3060", "-n"]
