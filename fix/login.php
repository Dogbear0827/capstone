<?php
// 偵錯用
//ini_set('display_errors', 1);
//error_reporting(E_ALL);

// 連接到資料庫
$servername = "localhost";
$username = "root"; // 根據你的設定更改這裡
$password = "00000000"; // 根據你的設定更改這裡，已經改成VM目前的樣子
$dbname = "account"; // 你的資料庫名稱，已經改成VM目前的樣子

// 創建連接
$conn = new mysqli($servername, $username, $password, $dbname);

// 檢查連接
if ($conn->connect_error) {
    die(json_encode(['status' => 'error', 'message' => '連接資料庫失敗: ' . $conn->connect_error]));
}

// 設定 Content-Type 為 JSON 以便於前端處理返回的結果
header('Content-Type: application/json');

// 如果是 POST 請求
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // 取得表單數據
    $user_username = trim($_POST['username']);
    $user_password = trim($_POST['password']);

    // 驗證資料
    $errors = [];

    if (empty($user_username)) {
        $errors[] = "請提供使用者名稱";
    }

    if (empty($user_password)) {
        $errors[] = "請提供密碼";
    }

    // 如果有錯誤，返回錯誤訊息
    if (count($errors) > 0) {
        echo json_encode(['status' => 'error', 'messages' => $errors]);
        exit();
    }

    // 使用預處理語句來查找用戶
    $stmt = $conn->prepare("SELECT * FROM users WHERE username=?");
    $stmt->bind_param("s", $user_username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        // 獲取用戶資料
        $user = $result->fetch_assoc();

        // 驗證密碼
        if (password_verify($user_password, $user['userpassword'])) {
            // 登入成功
            session_start();
            $_SESSION['username'] = $user['username'];

            // 返回成功訊息
            echo json_encode(['status' => 'success', 'message' => '登入成功！']);
            
            exit();
        } else {
            // 密碼錯誤
            echo json_encode(['status' => 'error', 'messages' => ['密碼錯誤，請再試一次']]);
        }
    } else {
        // 用戶名不存在
        echo json_encode(['status' => 'error', 'messages' => ['找不到此使用者名稱']]);
    }

    $stmt->close();
}

$conn->close();
?>
