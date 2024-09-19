ARG IMAGE_VERSION_BUILD=latest
ARG IMAGE_VERSION=22-bullseye-slim
ARG NODE_ENV=development

# Stage 1: Build
FROM node:${IMAGE_VERSION_BUILD} AS build
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and pnpm-lock.yaml to leverage Docker layer caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Stage 2: Production
FROM node:${IMAGE_VERSION}
ENV NODE_ENV ${NODE_ENV}

# Copy dumb-init from build stage
COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init

# Install pnpm in the production stage
RUN npm install -g pnpm

# Set working directory
RUN mkdir /usr/src/app && chown node:node /usr/src/app
WORKDIR /usr/src/app

# Copy node_modules from build stage
COPY --from=build /usr/src/app/node_modules ./node_modules

# Copy the rest of the application code
COPY . .

# Set user permissions
RUN chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Define the command to run your app
CMD ["dumb-init", "pnpm", "dev"]