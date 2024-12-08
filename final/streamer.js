const socket = new WebSocket('wss://' + window.location.hostname + ':8080'); // 連接到 WebSocket 伺服器

let name; // 用戶名稱
let peerConnection; // WebRTC peer connection
let localStream; // 本地媒體流

// 取得網頁上的元素
//const liveVideo = document.getElementById('liveVideo');
//const screenShareButton = document.getElementById('screenShareButton');
//const cameraShareButton = document.getElementById('cameraShareButton');
//const stopButton = document.getElementById('stopButton');

// 請求從後端檢查登入狀態並取得用戶名稱
fetch('check-login.php')
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            name = data.username; // 設置用戶名稱
            console.log(`用戶名稱: ${name}`);

            // 當 WebSocket 連線成功時
            socket.onopen = () => {
                console.log("Connected to WebSocket server");

                // 登錄到伺服器
                socket.send(JSON.stringify({
                    type: 'login',
                    name: name,
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
                        handleOffer(message.offer, message.streamer, message.roomCode);
                        break;

                    case 'candidate':
                        if (peerConnection) {
                            peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
                        }
                        break;

                    case 'answer':
                        if (peerConnection) {
                            peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
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

            // 初始化 WebRTC
            window.onload = async () => {
                try {
                    // 訪問媒體設備（攝像頭和麥克風）
                    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

                    // 顯示本地視頻
                    liveVideo.srcObject = localStream;

                    // 初始化 WebRTC 的 PeerConnection
                    peerConnection = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // 使用 Google 的 STUN 伺服器
                    });

                    // 將本地流添加到 PeerConnection
                    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

                    // 設定 ICE 候選的處理邏輯
                    peerConnection.onicecandidate = (event) => {
                        if (event.candidate) {
                            socket.send(JSON.stringify({
                                type: 'candidate',
                                candidate: event.candidate,
                                streamer: name,
                                roomCode: name, // 使用用戶名稱作為房間代碼
                            }));
                        }
                    };

                    // 設定按鈕點擊事件
                    screenShareButton.addEventListener('click', shareScreen);
                    cameraShareButton.addEventListener('click', shareMedia);
                    stopButton.addEventListener('click', stopSharing);

                } catch (err) {
                    console.error("Error accessing media devices: ", err);
                }
            };

            // 開始分享螢幕的函數
            async function shareScreen() {
                try {
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    // 停止原來的媒體流
                    localStream.getTracks().forEach(track => track.stop());

                    // 用螢幕分享流替換原來的本地流
                    localStream = screenStream;
                    liveVideo.srcObject = screenStream;

                    // 更新 PeerConnection
                    const tracks = localStream.getTracks();
                    peerConnection.getSenders().forEach(sender => sender.replaceTrack(tracks.find(track => track.kind === sender.track.kind)));

                    // 發送 `share` 訊息給伺服器，告訴伺服器主播開始了直播
                    socket.send(JSON.stringify({
                        type: 'share',
                        name: name,
                        roomCode: name, // 使用用戶名稱作為房間代碼
                    }));

                    // 創建 offer 並將其發送給伺服器
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);

                    socket.send(JSON.stringify({
                        type: 'offer',
                        offer: offer,
                        streamer: name,
                        roomCode: name, // 使用用戶名稱作為房間代碼
                    }));
                } catch (err) {
                    console.error("Error sharing screen: ", err);
                }
            }

            // 開始分享相機的函數
            async function shareMedia() {
                try {
                    // 獲取攝像頭流
                    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

                    // 停止螢幕分享流
                    localStream.getTracks().forEach(track => track.stop());

                    // 用攝像頭流替換原來的本地流
                    localStream = mediaStream;
                    liveVideo.srcObject = mediaStream;

                    // 更新 PeerConnection
                    const tracks = localStream.getTracks();
                    peerConnection.getSenders().forEach(sender => sender.replaceTrack(tracks.find(track => track.kind === sender.track.kind)));

                    // 創建 offer 並將其發送給伺服器
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);

                    socket.send(JSON.stringify({
                        type: 'offer',
                        offer: offer,
                        streamer: name,
                        roomCode: name, // 使用用戶名稱作為房間代碼
                    }));
                } catch (err) {
                    console.error("Error sharing media: ", err);
                }
            }

            // 停止分享的函數
            function stopSharing() {
                // 停止所有媒體流
                localStream.getTracks().forEach(track => track.stop());

                // 重設視頻顯示
                liveVideo.srcObject = null;

                // 發送停止分享訊息給伺服器
                socket.send(JSON.stringify({
                    type: 'stop',
                    streamer: name,
                    roomCode: name, // 使用用戶名稱作為房間代碼
                }));
            }

            // 處理觀眾的 offer
            async function handleOffer(offer, streamer, roomCode) {
                if (!peerConnection) {
                    peerConnection = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });

                    // 設定 ICE 候選的處理邏輯
                    peerConnection.onicecandidate = (event) => {
                        if (event.candidate) {
                            socket.send(JSON.stringify({
                                type: 'candidate',
                                candidate: event.candidate,
                                streamer: streamer,
                                roomCode: roomCode, // 傳遞房間代碼
                            }));
                        }
                    };
                }

                // 設定遠端 offer，並創建 answer 發送回主播
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.send(JSON.stringify({
                    type: 'answer',
                    answer: answer,
                    streamer: streamer,
                    roomCode: roomCode,  // 傳遞房間代碼
                }));
            }
        } else {
            alert('未登入或無效用戶');
        }
    })
    .catch(error => {
        console.error('Error fetching login data:', error);
    });
