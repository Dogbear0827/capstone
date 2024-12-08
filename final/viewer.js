const socket = new WebSocket('wss://localhost:8080'); // 連接到 WebSocket 伺服器

let peerConnections = {}; // 儲存每個直播主的 PeerConnection
let name; // 用戶名稱
let roomCode; // 房間代碼，從 URL 獲取

// 從 URL 中解析出房間代碼
const urlParams = new URLSearchParams(window.location.search);
roomCode = urlParams.get('code');

if (!roomCode) {
    alert("房間代碼無效或缺少");
    // 可能需要跳轉到某個頁面或提示用戶
}

console.log(`觀眾房間代碼: ${roomCode}`);

// 請求從後端檢查登入狀態並取得用戶名稱
fetch('check-login.php')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            name = data.username; // 設置用戶名稱
            console.log(`用戶名稱: ${name}`);

            // 當 WebSocket 連線成功時
            socket.onopen = () => {
                console.log("Connected to WebSocket server");

                // 登錄到伺服器
                socket.send(JSON.stringify({
                    type: 'login',
                    name: name,
                    roomCode: roomCode // 發送房間代碼
                }));
            };

            // 當 WebSocket 收到訊息時
            socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log("Received message: ", message);

                switch (message.type) {
                    case 'login':
                        if (message.success) {
                            console.log("Logged in successfully");
                        } else {
                            alert("Login failed: " + message.message);
                        }
                        break;

                    case 'offer':
                        handleOffer(message.offer, message.streamer);
                        break;

                    case 'candidate':
                        if (peerConnections[message.streamer]) {
                            peerConnections[message.streamer].addIceCandidate(new RTCIceCandidate(message.candidate));
                        }
                        break;

                    case 'answer':
                        if (peerConnections[message.streamer]) {
                            peerConnections[message.streamer].setRemoteDescription(new RTCSessionDescription(message.answer));
                        }
                        break;

                    default:
                        console.log("Unknown message type: ", message.type);
                        break;
                }
            };

            // 當 WebSocket 連線關閉時
            socket.onclose = () => {
                console.log("Disconnected from WebSocket server");
            };

            // 初始化顯示所有直播主的視頻
            window.onload = async () => {
                // 當觀看者加載時，請求特定房間內的主播視頻流
                socket.send(JSON.stringify({
                    type: 'getStreamForRoom', // 請求房間內的主播視訊流
                    roomCode: roomCode, // 發送房間代碼
                }));
            };

            // 處理來自直播主的 offer
            async function handleOffer(offer, streamer) {
                // 創建新的 PeerConnection
                const peerConnection = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });

                // 當獲得 ICE 候選時，發送給伺服器
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.send(JSON.stringify({
                            type: 'candidate',
                            candidate: event.candidate,
                            streamer: streamer,
                        }));
                    }
                };

                // 處理接收到的遠端流
                peerConnection.ontrack = (event) => {
                    const remoteStream = event.streams[0];

                    // 找到頁面上的視頻元素 (id="viewer")
                    const viewerVideo = document.getElementById('viewer');
                    
                    // 將遠端流設置為視頻元素的源
                    viewerVideo.srcObject = remoteStream;
                };

                // 設定遠端 offer，並創建 answer 發送回主播
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.send(JSON.stringify({
                    type: 'answer',
                    answer: answer,
                    streamer: streamer,
                }));

                // 儲存 PeerConnection
                peerConnections[streamer] = peerConnection;
            }

        } else {
            alert('未登入或無效用戶');
        }
    })
    .catch(error => {
        console.error('Error fetching login data:', error);
    });
