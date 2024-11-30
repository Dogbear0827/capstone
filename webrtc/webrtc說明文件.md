這是基於`webrtc.js`與`index.html`製作的對應表
如果要減少部分變數，請對應減少`webrtc.js`的功能

# 變數與 HTML 元素對應表

| 變數名稱               | 對應的 HTML 元素                      | HTML 元素的用途                          |
| -------------------- | --------------------------------- | ---------------------------------- |
| `remoteVideo`         | `<video id="remoteVideo">`         | 顯示遠端使用者的視訊流                 |
| `remoteAudio`         | `<audio id="remoteAudio">`         | 顯示遠端使用者的音訊流（僅音訊）       |
| `localVideo`          | `<video id="localVideo">`          | 顯示本地使用者的視訊流                 |
| `usernameInput`       | `<input id="usernameInput">`       | 用戶輸入的使用者名稱                  |
| `showUsername`        | `<span id="showLocalUserName">`    | 顯示本地使用者的名稱                  |
| `showRemoteUsername`  | `<span id="showRemoteUserName">`   | 顯示遠端使用者的名稱                  |
| `showAllUsers`        | `<span id="allUsers">`             | 顯示所有已登錄使用者的列表            |
| `callToUsernameInput` | `<input id="callToUsernameInput">` | 用戶輸入要撥打的目標使用者名稱        |
| `callOngoing`         | `<div id="callOngoing">`           | 顯示正在進行中的通話畫面              |
| `callInitiator`       | `<div id="callInitiator">`         | 顯示撥打通話的界面                    |
| `callReceiver`        | `<div id="callReceiver">`          | 顯示接聽來電的界面                    |
