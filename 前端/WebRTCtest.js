/** @type {RTCPeerConnection} */
let yourConn;  // 用來處理 WebRTC 連線的物件
let candidateQueue = [];  // 儲存 ICE 候選，防止對等端未準備好時先收到候選

let localUser;  // 儲存當前用戶名稱
let localStream;  // 本地的音訊和視訊流
let screenStream;  // 螢幕分享的媒體流
let connectedUser;  // 目前已連線的遠端用戶名稱

// WebRTC ICE 伺服器配置，用於發現對等方
const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// WebSocket 連線，用於和伺服器進行訊號交換
let serverConnection = new WebSocket('wss://' + window.location.hostname + ':8080');

serverConnection.onopen = () => {
    console.log('已成功連接至伺服器');
};

serverConnection.onmessage = gotMessageFromServer;

const usernameInput = document.getElementById('usernameInput');
const emailInput = document.getElementById('emailInput');
const showUsername = document.getElementById('showLocalUserName');

// 登入按鈕點擊事件
function loginClick(self) {
    const username = usernameInput.value;
    const email = emailInput.value;

    if (username.length > 0 && email.length > 0) {
        send({
            type: 'login',
            name: username,
            email: email,
        });

        self.outerHTML = `
        <button class="primary" onclick="share('m')">分享媒體</button>
        <button class="primary" onclick="share('s')">分享螢幕</button>`;
    } else {
        alert('請輸入使用者名稱與郵件');
    }
}

// 發送訊息至伺服器
function send(msg) {
    console.log('發送訊息:\n', msg);
    serverConnection.send(JSON.stringify(msg));
}

// 取得本地媒體流（視訊與音訊）
function getUserMediaSuccess(stream) {
    localStream = stream;
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    setupConnection(stream);
}

// 設定 WebRTC 連線配置，處理 ICE 候選與媒體流
function setupConnection(stream) {
    yourConn.onicecandidate = (event) => {
        if (event.candidate) {
            send({
                type: 'candidate',
                name: connectedUser,
                candidate: event.candidate,
            });
        }
    };

    yourConn.ontrack = (event) => {
        if (event.track.kind === 'video') {
            remoteVideo.srcObject = event.streams[0];
        } else if (event.track.kind === 'audio') {
            remoteAudio.srcObject = event.streams[0];
        }
    };

    stream.getTracks().forEach(track => {
        yourConn.addTrack(track, stream);
    });
}

function share(mediaType) {
    localUser = usernameInput.value;
    if (localUser.length > 0) {
        if (mediaType === 'm') {
            navigator.mediaDevices
                .getUserMedia({ video: true, audio: true })
                .then(getUserMediaSuccess)
                .catch(errorHandler);
        } else if (mediaType === 's') {
            navigator.mediaDevices
                .getDisplayMedia({ video: true, audio: true })
                .then((screenStream) => {
                    let combinedStream = new MediaStream();
                    screenStream.getTracks().forEach(track => combinedStream.addTrack(track));
                    if (localStream) {
                        localStream.getTracks().forEach(track => combinedStream.addTrack(track));
                    }
                    getUserMediaSuccess(combinedStream);
                });
        }
    } else {
        alert('請輸入使用者名稱');
    }
}

function errorHandler(error) {
    console.error(error);
}

// 處理伺服器發送來的訊息
function gotMessageFromServer(message) {
    const data = JSON.parse(message.data);
    switch (data.type) {
        case 'login':
            handleLogin(data.success, data.allUsers);
            break;
        case 'offer':
            handleOffer(data.offer, data.name);
            break;
        case 'answer':
            handleAnswer(data.answer);
            break;
        case 'candidate':
            handleCandidate(data.candidate);
            break;
        case 'hangup':
            handleHangUp();
            break;
        case 'users':
            refreshUserList(data.users);
            break;
        default:
            break;
    }
}

function handleLogin(success, allUsers) {
    if (success) {
        showUsername.innerHTML = localUser;
    } else {
        alert('登入失敗');
    }
}

function refreshUserList(users) {
    const allAvailableUsers = users.join(', ');
    showAllUsers.innerHTML = '可用使用者: ' + allAvailableUsers;
}
