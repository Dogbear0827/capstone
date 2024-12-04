// streamer.js
/** @type {RTCPeerConnection} */
let yourConn;
let localStream;
let connectedUser;

const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:your.turn.server:3478', // 修改為您的 TURN 伺服器地址
            username: 'your-username',         // 修改為您的 TURN 伺服器用戶名
            credential: 'your-password'        // 修改為您的 TURN 伺服器密碼
        }
    ]
};

let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8080');

// 當 WebSocket 連線成功時執行
serverConnection.onopen = () => {
    console.log('已成功連接至伺服器');
};

// 當接收到伺服器訊息時處理
serverConnection.onmessage = gotMessageFromServer;

function gotMessageFromServer(message) {
    const data = JSON.parse(message.data);
    console.log('收到訊息:', data);
    
    switch (data.type) {
        case 'login':
            console.log('登入成功', data);
            break;
        case 'answer':
            if (yourConn) {
                yourConn.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(errorHandler);
            }
            break;
        case 'candidate':
            if (yourConn) {
                yourConn.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(errorHandler);
            }
            break;
        default:
            console.log('未知的訊息類型:', data.type);
            break;
    }
}

// 分享鏡頭
function shareMedia() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('localVideo').srcObject = stream;
            startStreaming(stream);
        })
        .catch(errorHandler);
}

// 分享螢幕
function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({ video: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('localVideo').srcObject = stream;
            startStreaming(stream);
        })
        .catch(errorHandler);
}

// 停止分享
function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        document.getElementById('localVideo').srcObject = null;
    }
    if (yourConn) {
        yourConn.close();
        yourConn = null;
    }
}

function startStreaming(stream) {
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    stream.getTracks().forEach(track => yourConn.addTrack(track, stream));

    // 處理 ICE candidate
    yourConn.onicecandidate = (event) => {
        if (event.candidate) {
            sendToServer({
                type: 'candidate',
                candidate: event.candidate,
                name: 'streamer'
            });
        }
    };

    // 處理遠端 track
    yourConn.ontrack = (event) => {
        console.log('接收到遠端媒體流', event.streams[0]);
    };

    // 建立 offer 並發送至伺服器
    yourConn.createOffer()
        .then(offer => {
            return yourConn.setLocalDescription(offer);
        })
        .then(() => {
            sendToServer({
                type: 'offer',
                offer: yourConn.localDescription,
                name: 'streamer'
            });
        })
        .catch(errorHandler);
}

function sendToServer(msg) {
    serverConnection.send(JSON.stringify(msg));
}

function errorHandler(error) {
    console.error('錯誤發生:', error);
}
