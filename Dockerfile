# Start from a node image
FROM node:11
# Set the node environment variable to production
ENV NODE_ENV production
# Expose the default port 3000
EXPOSE 3000
# Set the working directory
WORKDIR /home/node/movie-night-app
# Copy all of the required files into the working directory
COPY [".", "."]
# Install all the required node packages
RUN npm install --only=prod
# Set the user as the node user
USER node
# Run the node command
CMD ["node", ".", "-o", "-c"]