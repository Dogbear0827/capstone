<?php
session_start();

// 檢查用戶是否登入
if (!isset($_SESSION['username'])) {
    // 如果未登入，重定向到登入頁面
    header("Location: login.html");
    exit();  // 結束腳本執行
}

// 如果已登入，返回用戶資料
echo json_encode(['status' => 'success', 'username' => $_SESSION['username']]);
?>
