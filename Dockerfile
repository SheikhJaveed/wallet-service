
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm install --production

# Copy application source code
COPY src ./src
COPY seed.sql ./seed.sql

EXPOSE 3000

CMD ["npm", "start"]
