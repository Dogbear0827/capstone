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

// 當接收到伺服器訊息時處理
serverConnection.onmessage = gotMessageFromServer;

/** @type {HTMLVideoElement} */
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const usernameInput = document.getElementById('usernameInput');
const showUsername = document.getElementById('showLocalUserName');
const showRemoteUsername = document.getElementById('showRemoteUserName');
const showAllUsers = document.getElementById('allUsers');
const callToUsernameInput = document.getElementById('callToUsernameInput');
const callOngoing = document.getElementById('callOngoing');
const callInitiator = document.getElementById('callInitiator');

// #region 登入與UI顯示處理
/**
 * 處理點擊登入按鈕後的動作
 * 根據設備型態顯示不同的按鈕
 * @param {HTMLInputElement} self
 */
function loginClick(self) {
    // 如果是行動裝置，顯示「分享媒體」按鈕，桌面設備顯示「分享媒體」與「分享螢幕」按鈕
    if (/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        self.outerHTML = `
        <button class="primary" onclick="share('m')">分享媒體</button>`;
    } else {
        self.outerHTML = `
        <button class="primary" onclick="share('m')">分享媒體</button>
        <button class="primary" onclick="share('s')">分享螢幕</button>`;
    }
}

/**
 * 處理點擊撥號按鈕後的行為
 * 會發送撥號訊息給伺服器，告知要撥打給指定的用戶
 */
function callBtnClick() {
    const callToUsername = callToUsernameInput.value;
    if (callToUsername.length > 0) {
        connectedUser = callToUsername;
        console.log('正在撥打給 ' + callToUsername);
        
        // 創建並發送 WebRTC 連線的邀請（offer）
        yourConn.createOffer()
            .then((offer) => {
                yourConn.setLocalDescription(offer).then(() => {
                    send({
                        type: 'offer',
                        name: connectedUser,
                        offer: offer,
                    });
                });
                callOngoing.style.display = 'block';  // 顯示正在通話畫面
                callInitiator.style.display = 'none'; // 隱藏撥號畫面
            })
            .catch((error) => {
                alert('創建邀請時出現錯誤', error);
                console.error('創建邀請時出現錯誤', error);
            });
    } else {
        alert("使用者名稱不能為空！");
    }
}

/**
 * 掛斷通話
 */
function hangUpClick() {
    send({
        type: 'hangup',
        name: localUser,
    });
    handleHangUp();  // 呼叫掛斷函式，處理掛斷邏輯
}

// 當頁面卸載時，關閉 WebSocket 連線
window.addEventListener('beforeunload', () => {
    serverConnection.close();  // 關閉 WebSocket 連線
});
// #endregion

/**
 * 處理伺服器發送來的訊息
 * @param {*} message
 */
function gotMessageFromServer(message) {
    console.log('收到訊息', message.data);
    const data = JSON.parse(message.data);

    switch (data.type) {
        case 'login':
            handleLogin(data.success, data.allUsers, data.share);
            break;
        case 'offer':
            handleOffer(data.offer, data.name);
            break;
        case 'answer':
            handleAnswer(data.answer);
            break;
        case 'decline':
            handleDecline(data.message);
            break;
        case 'candidate':
            handleCandidate(data.candidate);
            break;
        case 'leave':
            handleLeave();
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

    serverConnection.onerror = errorHandler;
}

// #region 工具函式
/**
 * 取得本地媒體流（視訊與音訊），並初始化 WebRTC 連線
 * @param {MediaStream} stream
 */
function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    console.log('取得本地媒體後的連線狀態', yourConn.connectionState);
    setupConnection(stream);  // 設置 WebRTC 連線

    // 添加排隊的候選者
    candidateQueue.forEach(candidate => yourConn.addIceCandidate(candidate).catch(errorHandler));
    candidateQueue = [];  // 清空候選者隊列
}

/**
 * 設定 WebRTC 連線配置，處理 ICE 候選與媒體流
 * @param {MediaStream} stream
 */
function setupConnection(stream) {
    yourConn.onicecandidate = (event) => {
        console.log('onicecandidate: ', event.candidate);
        if (event.candidate) {
            send({
                type: 'candidate',
                name: connectedUser,
                candidate: event.candidate,
            });
        }
    };

    yourConn.ontrack = (event) => {
        console.log('收到遠端流');
        showRemoteUsername.innerHTML = connectedUser;

        // 根據 track 類型顯示遠端視訊或音訊
        if (event.track.kind === 'video') {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.hidden = false;
        }
    };

    // 加入本地流的每一個 track 到 WebRTC 連線中
    stream.getTracks().forEach(track => {
        yourConn.addTrack(track, stream);
    });
}

/**
 * 處理來自對等方的 Offer
 * @param {RTCSessionDescriptionInit} offer
 * @param {string} name
 */
function handleOffer(offer, name) {
    connectedUser = name;
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    setupConnection(localStream);

    yourConn.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            return yourConn.createAnswer();
        })
        .then(answer => {
            return yourConn.setLocalDescription(answer);
        })
        .then(() => {
            send({
                type: 'answer',
                name: connectedUser,
                answer: yourConn.localDescription,
            });
        })
        .catch(errorHandler);
}

/**
 * 處理來自對等方的 Answer
 * @param {RTCSessionDescriptionInit} answer
 */
function handleAnswer(answer) {
    yourConn.setRemoteDescription(new RTCSessionDescription(answer)).catch(errorHandler);
}

/**
 * 處理來自對等方的 ICE 候選者
 * @param {RTCIceCandidateInit} candidate
 */
function handleCandidate(candidate) {
    if (yourConn && yourConn.remoteDescription) {
        yourConn.addIceCandidate(new RTCIceCandidate(candidate)).catch(errorHandler);
    } else {
        candidateQueue.push(candidate);
    }
}

/**
 * 錯誤處理函式
 * @param {Error} error
 */
function errorHandler(error) {
    console.error(error);
}

/**
 * 發送訊息至伺服器
 * @param {Object} msg
 */
function send(msg) {
    console.log('發送訊息:\n', msg);
    serverConnection.send(JSON.stringify(msg));  // 透過 WebSocket 發送訊息
}

/**
 * 根據媒體類型選擇分享媒體或螢幕
 * @param {'m'|'s'} mediaType
 */
function share(mediaType) {
    localUser = usernameInput.value;
    showUsername.innerHTML = localUser;
    if (localUser.length > 0) {
        if (mediaType === 'm') {
            // 分享媒體（音訊與視訊）
            navigator.mediaDevices
                .getUserMedia({
                    video: true,
                    audio: true,
                })
                .then(getUserMediaSuccess)
                .catch(errorHandler);
        } else if (mediaType === 's') {
            // 分享螢幕（音訊與視訊）
            navigator.mediaDevices
                .getDisplayMedia({
                    video: true,
                    audio: true, // 如果需要螢幕音訊
                })
                .then((screenStream) => {
                    let combinedStream = new MediaStream();
                    screenStream.getTracks().forEach(track => combinedStream.addTrack(track));

                    if (localStream) {
                        localStream.getTracks().forEach(track => combinedStream.addTrack(track));
                    }

                    // 使用合併後的音訊與視訊流
                    getUserMediaSuccess(combinedStream);
                })
                .catch(errorHandler);
        }
    } else {
        alert('請輸入使用者名稱');
    }
}

/** 處理對方離線的情況 */
function handleLeave() {
    handleHangUp();
}

/**
 * 處理掛斷動作，恢復初始狀態
 */
function handleHangUp() {
    connectedUser = null;
    remoteVideo.srcObject = null;
    remoteVideo.hidden = true;
    showRemoteUsername.innerHTML = '';

    callOngoing.style.display = 'none';
    callInitiator.style.display = 'block';

    // 關閉與對端的連線並重新初始化
    if (yourConn) {
        yourConn.close();
    }
    yourConn = new RTCPeerConnection(peerConnectionConfig);
    setupConnection(localStream);
}

/**
 * 刷新使用者列表
 * @param {string[]} users
 */
function refreshUserList(users) {
    const allAvailableUsers = users.join(', ');
    showAllUsers.innerHTML = '可用使用者: ' + allAvailableUsers;
}
// #endregion
