<?php
session_start();

// Check if the user is logged in
if (!isset($_SESSION['username'])) {
    header("Location: login.php"); // Redirect to login if not logged in
    exit();
}

// Logout functionality
if (isset($_GET['logout'])) {
    session_unset();
    session_destroy();
    header("Location: login.php"); // Redirect to login page after logout
    exit();
}
?>

<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoodStream</title>
    <style>
        /* Your existing styles here */
    </style>
</head>
<body>
    <!-- Header with Login/Logout button -->
    <div class="header">
        <h1>Welcome to GoodStream, <?php echo $_SESSION['username']; ?>!</h1>
        <a href="?logout=true"><button>Logout</button></a>
    </div>

    <!-- Your existing content like sidebar, main content, etc. -->

    <script>
        // JavaScript code for interacting with the page
    </script>
</body>
</html>
