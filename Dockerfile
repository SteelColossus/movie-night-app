# Start from a node image
FROM node:11
# Expose the default port 3000
EXPOSE 3000
# Set the working directory
WORKDIR /home/node/movie-night-app
# Copy all of the required files into the working directory
COPY [".", "."]
# Install all the required node packages
RUN npm install
# Set the user as the node user
USER node
# Run the node command
CMD ["node", ".", "-o"]