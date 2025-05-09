FROM node:22 as builder

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

###########################
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY ./config/default.js ./config/default.js
RUN npm install --only=prod

COPY --from=builder /usr/src/app/dist .
# COPY --from=builder /usr/src/app/src/infrastructure/grpc/protos/*.proto ./infrastructure/grpc/protos/
EXPOSE 8888

# NOTE: the mds state machine is broken up into two components. The first is the
# API server which is the presentation/server.js file. The second is the worker
# which is the /worker/entry-point.js file.
CMD [ "node", "./presentation/server.js" ]

# To ship logs to the ELK stack extend the above command
# with either pino-socket, pino-logstash or mds-log-pump.
# An example using mds-log-pump can be found in the mds
# stack configurations. This utilizes a simple config file
# and allows a out-of-process to handle shipping logs to
# the ELK stack.
#
# If you chose to use pino-socket or pino-logstash you will
# need to refer to their documentation for configuration.
#
# Ex: CMD [ "node", "./server.js", "|", "mds-log-pump"]
# Ex: CMD [ "node", "./server.js", "|", "pino-logstash", "-h", "elk", "-p", "5000" ]
# Ex: CMD [ "node", "./server.js", "|", "pino-socket", "-h", "elk", "-p", "5000" ]