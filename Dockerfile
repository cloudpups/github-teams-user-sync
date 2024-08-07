FROM node:20 AS Build
ARG NPM_REGISTRY="https://registry.npmjs.org"
WORKDIR /usr/src/app
COPY . .
RUN npm config set registry ${NPM_REGISTRY}
RUN npm install
RUN npm run build
RUN npm ci --omit=dev

FROM node:20-alpine

COPY --chown=node --from=Build /usr/src/app/package.json /usr/src/app/package.json
COPY --chown=node --from=Build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node --from=Build /usr/src/app/out/ /usr/src/app/out/

RUN apk update && apk upgrade

USER node

WORKDIR /usr/src/app

CMD npm run start
