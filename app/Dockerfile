FROM node:16-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the entire current directory to the working directory
COPY . .

# Expose the port on which your Node.js application will run
EXPOSE 80

# Set the environment variable defaults; others should be passed in
ENV NODE_EXPRESS_PORT=80
ENV USE_MANAGED_IDENTITIES=true
ENV POSTGRES_SERVER_PORT=5432
ENV REDIS_SERVER_PORT=6380

# Start the server with index.js
CMD ["node", "index.js"]