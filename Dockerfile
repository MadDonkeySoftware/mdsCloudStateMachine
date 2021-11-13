FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=prod

# Only copy stuff we want in the final image.
# COPY . .
COPY ./bin/ ./bin/
COPY ./src/ ./src/

# RUN rm -r ./**/*.test.js

EXPOSE 8888

ENTRYPOINT [ "node", "./bin/entrypoint" ]
CMD [ "server" ]