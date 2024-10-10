<?php
// 引入資料庫配置檔案
require 'db_connection.php';

// 確認表單資料是否被提交
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // 接收表單資料
    $user = trim($_POST['username']);
    $email = trim($_POST['email']);
    $pass = password_hash(trim($_POST['userpassword']), PASSWORD_DEFAULT); // 加密密碼

    // 檢查用戶名或電子郵件是否已存在
    $check_sql = "SELECT * FROM users WHERE username=? OR email=?";
    $stmt = $conn->prepare($check_sql);
    if ($stmt === false) {
        die("<script>alert('準備查詢失敗: " . $conn->error . "'); history.back();</script>");
    }
    $stmt->bind_param("ss", $user, $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        echo "<script>alert('用戶名或電子郵件已存在，請重新選擇。'); history.back();</script>";
    } else {
        // 插入數據
        $sql = "INSERT INTO users (username, email, userpassword) VALUES (?, ?, ?)";
        $stmt = $conn->prepare($sql);
        if ($stmt === false) {
            die("<script>alert('準備插入失敗: " . $conn->error . "'); history.back();</script>");
        }
        $stmt->bind_param("sss", $user, $email, $pass);

        if ($stmt->execute()) {
            echo "<script>alert('註冊成功！'); window.location.href = 'login.html';</script>";
        } else {
            echo "<script>alert('錯誤: " . $stmt->error . "'); history.back();</script>";
        }
    }

    // 關閉連接
    $stmt->close();
    $conn->close();
} else {
    echo "<script>alert('無效的請求方法。'); history.back();</script>";
}
?>
