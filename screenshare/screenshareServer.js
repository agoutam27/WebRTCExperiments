"use strict";

var http = require('http');
var fs = require('fs');
const url = require('url');
const path = require('path');

var WebSocketServer = require('websocket').server;

// Used for managing the text chat user list.

var connectionArray = [];
var nextID = Date.now();

// Output logging information to console

function log(text) {
    var time = new Date();
    console.log("[" + time.toLocaleTimeString() + "] " + text);
}

// If you want to implement support for blocking specific origins, this is
// where you do it. Just return false to refuse WebSocket connections given
// the specified origin.
function originIsAllowed(origin) {
    return true; // We will accept all connections
}

// Sends a message (which is already stringified JSON) to a single
// user, given their username. We use this for the WebRTC signaling,
// and we could use it for private text messaging.
function sendToOneUser(target, msgString) {

    for (var i = 0; i < connectionArray.length; i++) {
        if (connectionArray[i].username === target) {
            connectionArray[i].sendUTF(msgString);
            break;
        }
    }
}

// Scan the list of connections and return the one for the specified
// clientID. Each login gets an ID that doesn't change during the session,
// so it can be tracked across username changes.
function getConnectionForID(id) {
    var connect = null;
    var i;

    for (i = 0; i < connectionArray.length; i++) {
        if (connectionArray[i].clientID === id) {
            connect = connectionArray[i];
            break;
        }
    }

    return connect;
}

var webServer = null;

try {
    log(`attempting to create webserver`);
    webServer = http.createServer(handleWebRequest);
    log(`Created http server`);
} catch (err) {
    webServer = null;
    log(`Error attempting to create HTTP server: ${err.toString()}`);
}



// Our HTTPS server does nothing but service WebSocket
// connections, so every request just returns 404. Real Web
// requests are handled by the main server on the box. If you
// want to, you can return real HTML here and serve Web content.

function handleWebRequest(req, res) {
    log("Received request for " + req.url);
    // parse URL
    const parsedUrl = url.parse(req.url);
    // extract URL path
    let pathname = `.${parsedUrl.pathname}`;
    // based on the URL path, extract the file extention. e.g. .js, .doc, ...
    const ext = path.parse(pathname).ext;
    // maps file extention to MIME typere
    const map = {
        '.ico': 'image/x-icon',
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword'
    };

    fs.exists(pathname, function (exist) {
        if (!exist) {
            // if the file is not found, return 404
            res.statusCode = 404;
            res.end(`File ${pathname} not found!`);
            return;
        }

        // if is a directory search for index file matching the extention
        if (fs.statSync(pathname).isDirectory()) pathname += '/index' + ext;

        // read file from file system
        fs.readFile(pathname, function (err, data) {
            if (err) {
                res.statusCode = 500;
                res.end(`Error getting the file: ${err}.`);
            } else {
                // if the file is found, set Content-type and send data
                res.setHeader('Content-type', map[ext] || 'text/plain');
                // res.setHeader('Feature-Policy', "display-capture 'self'");
                res.end(data);
            }
        });
    });
}

// Spin up the HTTPS server on the port assigned to this sample.
// This will be turned into a WebSocket port very shortly.

webServer.listen(6503, function () {
    log("Server is listening on port 6503");
});

// Create the WebSocket server by converting the HTTPS server into one.

var wsServer = new WebSocketServer({
    httpServer: webServer,
    autoAcceptConnections: false
});

if (!wsServer) {
    log("ERROR: Unable to create WbeSocket server!");
}

// Set up a "connect" message handler on our WebSocket server. This is
// called whenever a user connects to the server's port using the
// WebSocket protocol.

wsServer.on('request', function (request) {
    if (!originIsAllowed(request.origin)) {
        request.reject();
        log("Connection from " + request.origin + " rejected.");
        return;
    }

    // Accept the request and get a connection.

    var connection = request.accept("json", request.origin);

    // Add the new connection to our list of connections.

    log("Connection accepted from " + connection.remoteAddress + ".");
    connectionArray.push(connection);

    connection.clientID = nextID;
    nextID++;

    // Send the new client its token; it send back a "username" message to
    // tell us what username they want to use.

    var msg = {
        type: "id",
        id: connection.clientID
    };
    connection.sendUTF(JSON.stringify(msg));

    // Set up a handler for the "message" event received over WebSocket. This
    // is a message sent by a client, and may be text to share with other
    // users, a private message (text or signaling) for one user, or a command
    // to the server.

    connection.on('message', function (message) {
        console.log("The original message = ",message);
        if (message.type === 'utf8') {
            log("Received Message: " + message.utf8Data);

            msg = JSON.parse(message.utf8Data);
            var connect = getConnectionForID(msg.id);

            if (msg.type === "username")
                connect.username = msg.name;

            var msgString = JSON.stringify(msg);
            if (msg.target && msg.target !== undefined && msg.target.length !== 0) {
                sendToOneUser(msg.target, msgString);
            }

        }
    });

    // Handle the WebSocket "close" event; this means a user has logged off
    // or has been disconnected.
    connection.on('close', function (reason, description) {
        // First, remove the connection from the list of connections.
        connectionArray = connectionArray.filter(function (el, idx, ar) {
            return el.connected;
        });

        // Build and output log output for close information.

        var logMessage = "Connection closed: " + connection.remoteAddress + " (" +
            reason;
        if (description !== null && description.length !== 0) {
            logMessage += ": " + description;
        }
        logMessage += ")";
        log(logMessage);
    });
});