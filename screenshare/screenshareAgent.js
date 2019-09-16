(function () {
    var scheme = "ws";
    var rtcConfig = {};
    if (document.location.protocol === "https:") {
        scheme += "s";
        rtcConfig = {
            'iceServers': [{
                    "url": "stun:stun.l.google.com:19302"
                },
                {
                    "url": "stun:stun1.l.google.com:19302"
                },
                {
                    "url": "stun:stun2.l.google.com:19302"
                },
                {
                    "url": "stun:stun3.l.google.com:19302"
                },
                {
                    "url": "stun:stun4.l.google.com:19302"
                },
                {
                    "url": "stun:stunserver.org"
                },
                {
                    "url": "stun:stun.xten.com"
                },
                {
                    "url": "turn:numb.viagenie.ca",
                    "credential": "muazkh",
                    "username": "webrtc@live.com"
                },
                {
                    "url": "turn:192.158.29.39:3478?transport=udp",
                    "credential": "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
                    "username": "28224511:1379330808"
                },
                {
                    "url": "turn:192.158.29.39:3478?transport=tcp",
                    "credential": "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
                    "username": "28224511:1379330808"
                }
            ]
        };
    }
    // var url = "ws://10.0.11.11:6503";
    var url = scheme + "://" + window.location.host;
    var myPeerConnection = null;
    var agentName = "agent141";
    var username = "user121";

    var step = 0;

    var wsConn = new WebSocket(url, "json");

    wsConn.onopen = function (evt) {
        console.log(`Step: ${++step} => `, "Successfully established connection");
    }

    wsConn.onerror = function (evt) {
        alert("Could not establish connection with server");
    }

    wsConn.onmessage = function (evt) {

        var msg = JSON.parse(evt.data);

        switch (msg.type) {
            case "id":
                setUsername(msg.id);
                break;

            case "screen-share":
                handleVideoOfferMsg(msg);
                break;

            case "new-ice-candidate": // A new ICE candidate has been received
                handleNewICECandidateMsg(msg);
                break;

            case "hang-up": // The other peer has hung up the call
                closeVideoCall();
                break;

            default:
                alert("Something went wrong");
                return;
        }
    }

    function sendToServer(msg) {
        var msgJSON = JSON.stringify(msg);

        var length = msgJSON.length;
        var msgJSONLog = msgJSON.substr(0, 20) + (length > 20 ? "..." : "");
        console.log(`Step: ${++step} => `, "Sending '" + msg.type + "' message: " + msgJSONLog);
        wsConn.send(msgJSON);
    }

    function setUsername(id) {

        sendToServer({
            name: agentName,
            date: Date.now(),
            id: id,
            type: "username"
        });
    }

    function createPeerConnection() {
        myPeerConnection = new RTCPeerConnection(rtcConfig);

        // Set up event handlers for the ICE negotiation process.

        myPeerConnection.onicecandidate = handleICECandidateEvent;
        myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
        // myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
        myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
        // myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
        myPeerConnection.ontrack = handleTrackEvent;
    }

    function handleTrackEvent(event) {
        console.log(`Step: ${++step} => `, "*** Track event");
        document.getElementById("received_video").srcObject = event.streams[0];
        document.getElementById("hangup-button").disabled = false;
    }

    function handleICECandidateEvent(event) {
        if (event.candidate) {
            console.log(`Step: ${++step} => `, "*** Outgoing ICE candidate: " + event.candidate.candidate);
            sendToServer({
                type: "new-ice-candidate",
                target: username,
                candidate: event.candidate
            });
        }
    }

    function handleSignalingStateChangeEvent(event) {
        console.log(`Step: ${++step} => `, "*** WebRTC signaling state changed to: " + myPeerConnection.signalingState);
        switch (myPeerConnection.signalingState) {
            case "closed":
                closeVideoCall();
                break;
        }
    }

    async function handleNewICECandidateMsg(msg) {
        var candidate = new RTCIceCandidate(msg.candidate);
        console.log(`Step: ${++step} => `, "*** Adding received ICE candidate: " + JSON.stringify(candidate));
        try {
            await myPeerConnection.addIceCandidate(candidate)
        } catch (err) {
            console.error(err);
        }
    }

    // async function handleNegotiationNeededEvent() {
    //     console.log(`Step: ${++step} => `, "*** Negotiation needed");

    //     try {
    //         console.log(`Step: ${++step} => `, "---> Creating offer");
    //         const offer = await myPeerConnection.createOffer();

    //         // If the connection hasn't yet achieved the "stable" state,
    //         // return to the caller. Another negotiationneeded event
    //         // will be fired when the state stabilizes.

    //         if (myPeerConnection.signalingState != "stable") {
    //             console.log(`Step: ${++step} => `, "     -- The connection isn't stable yet; postponing...")
    //             return;
    //         }

    //         // Establish the offer as the local peer's current
    //         // description.

    //         console.log(`Step: ${++step} => `, "---> Setting local description to the offer");
    //         await myPeerConnection.setLocalDescription(offer);

    //         // Send the offer to the remote peer.

    //         console.log(`Step: ${++step} => `, "---> Sending the offer to the remote peer");
    //         sendToServer({
    //             name: agentName,
    //             target: username,
    //             sdp: myPeerConnection.localDescription
    //         });
    //     } catch (err) {
    //         console.error(err);
    //     };
    // }

    function handleICEConnectionStateChangeEvent(event) {
        console.log(`Step: ${++step} => `, "*** ICE connection state changed to " + myPeerConnection.iceConnectionState);

        switch (myPeerConnection.iceConnectionState) {
            case "closed":
            case "failed":
            case "disconnected":
                closeVideoCall();
                break;
        }
    }

    async function handleVideoOfferMsg(msg) {

        // If we're not already connected, create an RTCPeerConnection
        // to be linked to the caller.

        console.log(`Step: ${++step} => `, "Received video chat offer from " + username);
        if (!myPeerConnection) {
            createPeerConnection();
        }

        // We need to set the remote description to the received SDP offer
        // so that our local WebRTC layer knows how to talk to the caller.

        var desc = new RTCSessionDescription(msg.sdp);

        // If the connection isn't stable yet, wait for it...

        if (myPeerConnection.signalingState != "stable") {
            console.log(`Step: ${++step} => `, "  - But the signaling state isn't stable, so triggering rollback");

            // Set the local and remove descriptions for rollback; don't proceed
            // until both return.
            await Promise.all([
                myPeerConnection.setLocalDescription({
                    type: "rollback"
                }),
                myPeerConnection.setRemoteDescription(desc)
            ]);
            return;
        } else {
            console.log(`Step: ${++step} => `, "  - Setting remote description");
            await myPeerConnection.setRemoteDescription(desc);
        }

        console.log(`Step: ${++step} => `, "---> Creating and sending answer to caller");

        await myPeerConnection.setLocalDescription(await myPeerConnection.createAnswer());

        sendToServer({
            name: agentName,
            target: username,
            type: "video-answer",
            sdp: myPeerConnection.localDescription
        });
    }

    window.hangUpCall = function () {
        closeVideoCall();
        sendToServer({
            name: agentName,
            target: username,
            type: "hang-up"
        });
    }

    function closeVideoCall() {

        console.log(`Step: ${++step} => `, "Closing the call");

        if (myPeerConnection) {
            console.log(`Step: ${++step} => `, "--> Closing the peer connection");

            // Disconnect all our event listeners; we don't want stray events
            // to interfere with the hangup while it's ongoing.

            myPeerConnection.ontrack = null;
            myPeerConnection.onnicecandidate = null;
            myPeerConnection.oniceconnectionstatechange = null;
            myPeerConnection.onsignalingstatechange = null;
            myPeerConnection.onicegatheringstatechange = null;
            myPeerConnection.onnotificationneeded = null;

            document.getElementById("received_video").srcObject.getTracks().forEach(track => {
                track.stop();
            });

            myPeerConnection.close();
            myPeerConnection = null;
            screenShareStream = null;
        }

        document.getElementById("hangup-button").disabled = true;

    }
})();