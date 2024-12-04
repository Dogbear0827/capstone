// viewer.js
const remoteVideo = document.getElementById('remoteVideo');
let viewerConn;

const viewerPeerConnectionConfig = {
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

let viewerServerConnection = new WebSocket('wss://' + window.location.hostname + ':8080');

// 當 WebSocket 連接開啟時
viewerServerConnection.onopen = () => {
    console.log('WebSocket 連接已建立');
    // 登入為 viewer
    viewerServerConnection.send(JSON.stringify({
        type: 'login',
        name: 'viewer',
    }));
};

// 接收伺服器訊息
viewerServerConnection.onmessage = gotViewerMessageFromServer;

function gotViewerMessageFromServer(message) {
    const data = JSON.parse(message.data);
    console.log('收到訊息:', data);

    switch (data.type) {
        case 'offer':
            handleOffer(data.offer);
            break;
        case 'candidate':
            if (viewerConn) {
                viewerConn.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(viewerErrorHandler);
            }
            break;
        default:
            console.log('未知的訊息類型:', data.type);
            break;
    }
}

function handleOffer(offer) {
    viewerConn = new RTCPeerConnection(viewerPeerConnectionConfig);
    viewerConn.ontrack = handleViewerTrack;
    viewerConn.onicecandidate = (event) => {
        if (event.candidate) {
            sendViewerToServer({
                type: 'candidate',
                candidate: event.candidate,
                name: 'viewer'
            });
        }
    };

    viewerConn.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => viewerConn.createAnswer())
        .then(answer => {
            return viewerConn.setLocalDescription(answer);
        })
        .then(() => {
            sendViewerToServer({
                type: 'answer',
                answer: viewerConn.localDescription,
                name: 'viewer'
            });
        })
        .catch(viewerErrorHandler);
}

function handleViewerTrack(event) {
    console.log('收到遠端媒體流', event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
}

function sendViewerToServer(msg) {
    viewerServerConnection.send(JSON.stringify(msg));
}

function viewerErrorHandler(error) {
    console.error('錯誤發生:', error);
}
