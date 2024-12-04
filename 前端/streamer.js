/** @type {RTCPeerConnection} */
let yourConn;  // 用來處理 WebRTC 連線的物件
let localStream;  // 用來儲存本地媒體流（視訊/音訊）

// HTML 元素的按鈕監聽器：分享媒體、分享螢幕、停止分享
document.getElementById('screenShareButton').addEventListener('click', shareScreen);
document.getElementById('cameraShareButton').addEventListener('click', shareMedia);
document.getElementById('stopButton').addEventListener('click', stopSharing);

// WebRTC ICE 伺服器配置，用於對等連線時發現對方
const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// 當 WebSocket 連線建立時
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8080');  // 與伺服器建立 WebSocket 連線

serverConnection.onopen = () => {
    console.log('已成功連接至伺服器');
};

serverConnection.onmessage = gotMessageFromServer;

function gotMessageFromServer(message) {
    const data = JSON.parse(message.data);
    // 處理伺服器訊息...
}

// 開始分享鏡頭
function shareMedia() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('liveVideo').srcObject = stream;

            // 建立 WebRTC 連線
            yourConn = new RTCPeerConnection(peerConnectionConfig);
            localStream.getTracks().forEach(track => {
                yourConn.addTrack(track, localStream);
            });

            // 用於處理 ICE candidate 等
            yourConn.onicecandidate = handleICECandidate;
            yourConn.ontrack = handleTrack;
        })
        .catch(err => {
            console.error("取得媒體失敗", err);
        });
}

// 開始分享螢幕
function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({ video: true })
        .then(stream => {
            localStream = stream;
            document.getElementById('liveVideo').srcObject = stream;

            // 建立 WebRTC 連線
            yourConn = new RTCPeerConnection(peerConnectionConfig);
            localStream.getTracks().forEach(track => {
                yourConn.addTrack(track, localStream);
            });

            // 用於處理 ICE candidate 等
            yourConn.onicecandidate = handleICECandidate;
            yourConn.ontrack = handleTrack;
        })
        .catch(err => {
            console.error("螢幕分享失敗", err);
        });
}

// 停止分享
function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        document.getElementById('liveVideo').srcObject = null;
    }

    if (yourConn) {
        yourConn.close();
        yourConn = null;
    }
}

// 當收到對方的 ICE candidate
function handleICECandidate(event) {
    if (event.candidate) {
        serverConnection.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
        }));
    }
}

// 當 WebRTC 接收到對方的媒體流
function handleTrack(event) {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    document.body.appendChild(remoteVideo);
}
