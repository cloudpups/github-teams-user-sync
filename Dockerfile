FROM node:18 AS Build
ARG NPM_REGISTRY
WORKDIR /usr/src/app
COPY . .
RUN npm config set registry ${NPM_REGISTRY} && \
    npm install && \
    npm run build && \
    npm ci --omit=dev

FROM node:18-alpine

COPY --chown=node --from=Build /usr/src/app/package.json /usr/src/app/package.json
COPY --chown=node --from=Build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --chown=node --from=Build /usr/src/app/out/src/ /usr/src/app/out/src/

USER node

WORKDIR /usr/src/app

CMD npm run start