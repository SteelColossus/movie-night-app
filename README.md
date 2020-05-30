# movie-night-app
A voting application for our weekly movie night.

## Running locally
1. Install [node/npm](https://nodejs.org).
2. Run `npm install` from the application's base folder.
3. Run `npm start`. If ran in a console window, you should see the line "Now listening on: http://localhost:3000"
4. Go to http://localhost:3000 in a web browser and you should see the app running live.
## Running on a different port
If you want the app to run on a port other than 3000, you can use the `$PORT` environment variable to specify a different port number.

## Running from Docker
You can run the latest version of the app from Docker by running the following command:
```
docker run -d --name movie-night-app -p 3000:3000 steelcolossus/movie-night-app
```
You can then go to http://localhost:3000 as normal to see the app running live.  
_(**Note**: You will need pull access to the Docker repository in order to do this.)_

If you are running the app on a Raspberry Pi or another arm32 device, then use the image `steelcolossus/movie-night-app:arm32v7` instead.

## Exposing the app to everyone on the same network
You can allow anyone on the same network to access the app by passing the `-o` flag to the `node` command, e.g. `node . -o`.  

You should now be able to see the app at the address that it lists in the console. The hostname will be the name of your machine and the port will be 3000. Using the local IP address as listed by commands like `ipconfig` with port 3000 will also work.  

If running through docker, instead map port 3000 on the container to your local hostname/IP, e.g. put the port flag as `-p <local IP>:3000:3000`.  

## Running the app without a password
By default the movie night app requires a password to be entered to host a movie night. This password is randomly generated and outputted in the logs. If you do not want the app to require a password, pass the `--no-password` argument to the run command.  
