package com.keypass.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.keypass.app.data.PrefsManager
import com.keypass.app.data.TokenManager
import com.keypass.app.network.ApiClient
import com.keypass.app.ui.screens.*
import com.keypass.app.ui.theme.KeyPassTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        PrefsManager.init(this)
        TokenManager.init(this)

        val registrationToken = extractRegistrationToken(intent)
        val apiUrl = extractApiUrl(intent)

        // Set API base URL from deep link or saved preference
        if (apiUrl != null) {
            ApiClient.setBaseUrl(apiUrl)
            PrefsManager.serverUrl = apiUrl
            Log.d("KeyPass", "API URL from deep link: $apiUrl")
        } else if (PrefsManager.serverUrl != null) {
            ApiClient.setBaseUrl(PrefsManager.serverUrl!!)
            Log.d("KeyPass", "API URL from saved prefs: ${PrefsManager.serverUrl}")
        }

        Log.d("KeyPass", "Token: $registrationToken, API: ${ApiClient.baseUrl}")

        setContent {
            KeyPassTheme {
                KeyPassApp(
                    initialToken = registrationToken,
                    isRegistered = PrefsManager.isRegistered
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
    }

    private fun extractRegistrationToken(intent: Intent?): String? {
        val data = intent?.data ?: return null
        return data.getQueryParameter("token")
    }

    private fun extractApiUrl(intent: Intent?): String? {
        val data = intent?.data ?: return null
        // Deep link: keypass://register?token=xxx&api=https://example.com
        val apiParam = data.getQueryParameter("api")
        if (apiParam != null) return apiParam
        // If opened via https link: extract the scheme+host as API base
        if (data.scheme == "https" || data.scheme == "http") {
            return "${data.scheme}://${data.host}" + (if (data.port != -1) ":${data.port}" else "")
        }
        return null
    }
}

@Composable
fun KeyPassApp(initialToken: String?, isRegistered: Boolean) {
    var token by remember { mutableStateOf(initialToken) }
    var showSetup by remember { mutableStateOf(!isRegistered || initialToken != null) }

    if (showSetup && token != null) {
        SetupScreen(
            token = token,
            onSetupComplete = { showSetup = false }
        )
    } else if (!isRegistered) {
        // No token — show manual entry screen
        ManualTokenScreen(onTokenEntered = { enteredToken, apiUrl ->
            if (apiUrl != null) {
                ApiClient.setBaseUrl(apiUrl)
                PrefsManager.serverUrl = apiUrl
            }
            token = enteredToken
            showSetup = true
        })
    } else {
        MainNavigation()
    }
}

@Composable
fun ManualTokenScreen(onTokenEntered: (String, String?) -> Unit) {
    var input by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("🔑", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            "KeyPass",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "הדבק את הקישור שקיבלת ב-WhatsApp",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = input,
            onValueChange = { input = it; error = null },
            label = { Text("קישור או קוד הרשמה") },
            placeholder = { Text("https://... או קוד") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            isError = error != null,
            supportingText = error?.let { { Text(it) } }
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                val trimmed = input.trim()
                if (trimmed.isBlank()) {
                    error = "הדבק קישור או קוד"
                    return@Button
                }
                // Parse: could be full URL or just token
                if (trimmed.contains("token=")) {
                    // Extract token from URL
                    val uri = android.net.Uri.parse(trimmed)
                    val t = uri.getQueryParameter("token")
                    val api = uri.getQueryParameter("api")
                        ?: if (uri.scheme == "https" || uri.scheme == "http") {
                            "${uri.scheme}://${uri.host}" + (if (uri.port != -1) ":${uri.port}" else "")
                        } else null
                    if (t != null) {
                        onTokenEntered(t, api)
                    } else {
                        error = "לא נמצא טוקן בקישור"
                    }
                } else if (trimmed.length >= 16 && trimmed.all { it.isLetterOrDigit() }) {
                    // Raw token
                    onTokenEntered(trimmed, null)
                } else {
                    error = "קישור לא תקין"
                }
            },
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text("המשך", fontSize = 18.sp)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainNavigation() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    data class NavItem(val route: String, val label: String, val icon: @Composable () -> Unit)

    val items = listOf(
        NavItem("home", "בית") { Icon(Icons.Default.Home, contentDescription = null) },
        NavItem("history", "היסטוריה") { Icon(Icons.Default.History, contentDescription = null) },
        NavItem("settings", "הגדרות") { Icon(Icons.Default.Settings, contentDescription = null) },
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                items.forEach { item ->
                    NavigationBarItem(
                        icon = item.icon,
                        label = { Text(item.label) },
                        selected = currentRoute == item.route,
                        onClick = {
                            if (currentRoute != item.route) {
                                navController.navigate(item.route) {
                                    popUpTo("home") { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        }
                    )
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier.padding(padding)
        ) {
            composable("home") { HomeScreen() }
            composable("history") { HistoryScreen() }
            composable("settings") {
                SettingsScreen(onLogout = {
                    navController.context.let { ctx ->
                        val intent = (ctx as ComponentActivity).intent
                        ctx.finish()
                        ctx.startActivity(intent)
                    }
                })
            }
        }
    }
}
