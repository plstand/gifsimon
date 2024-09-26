# GIFsimon

## Purpose

This is a response to [a challenge](https://codegolf.stackexchange.com/questions/5933/create-a-user-profile-mini-game) on the Programming Puzzles & Code Golf Stack Exchange site to create a game that will work inside a user profile there. This means making each button a hyperlink, running all code on a separate web server, and displaying output by dynamically generating images. An unwritten rule is that hyperlinks may not point directly to the game's web server. This requires otherwise unnecessary referrer checking and careful session handling.

I have based this game on a classic game by Milton Bradley called [Simon](https://en.wikipedia.org/wiki/Simon_%28game%29), as I mainly want to demonstrate that user profile games can incorporate animation using a simple game that hopefully everyone already knows how to play. However, there is no time limit, which I consider to be unnecessary. Also, you cannot win this game; you only can either stop playing or lose sooner or later.

## Method

The GIF animations are dynamically created using a palette animation technique involving a separate color table for each frame. This avoids the need for a graphics drawing library such as [gd](https://libgd.github.io/).

## How to run

This app was deployed on Heroku from July 2012 to May 2018. It underwent changes in March 2018 to make it compatible with Node v8.

If you would like to run your own instance locally, first install the dependencies:

    npm install

Once the dependencies are installed, start the web server using this command line:

    PORT=5000 npm start

Replace `5000` with the desired HTTP port.

Note that this app's simple session handling scheme only works for a single server process. When deploying to Heroku, the "web" process type must not be scaled to more than a single dyno (application container).

## License

[MIT License](LICENSE.md)
