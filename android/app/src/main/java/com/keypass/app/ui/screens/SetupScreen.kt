package com.keypass.app.ui.screens

import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.keypass.app.BuildConfig
import com.keypass.app.crypto.KeyManager
import com.keypass.app.data.PrefsManager
import com.keypass.app.data.TokenManager
import com.keypass.app.network.ApiClient
import com.keypass.app.network.RegisterDeviceRequest
import com.keypass.app.network.VerifyTokenRequest
import com.keypass.app.ui.theme.*
import kotlinx.coroutines.launch

enum class SetupStep {
    REGISTERING, SUCCESS, ERROR
}

@Composable
fun SetupScreen(
    token: String?,
    onSetupComplete: () -> Unit
) {
    var step by remember { mutableStateOf(SetupStep.REGISTERING) }
    var error by remember { mutableStateOf<String?>(null) }
    var statusText by remember { mutableStateOf("מאמת...") }
    val scope = rememberCoroutineScope()

    // Start registration immediately
    LaunchedEffect(token) {
        if (token == null) {
            error = "טוקן חסר"
            step = SetupStep.ERROR
            return@LaunchedEffect
        }

        try {
            // Step 1: Verify token is valid
            statusText = "מאמת טוקן..."
            Log.d("KeyPass", "Verifying token: ${token.take(10)}... API: ${ApiClient.baseUrl}")
            val verification = ApiClient.api.verifyToken(VerifyTokenRequest(token))
            if (!verification.valid) {
                error = "הקישור פג תוקף. בקש מהמנהל קישור חדש."
                step = SetupStep.ERROR
                return@LaunchedEffect
            }
            Log.d("KeyPass", "Token valid. User: ${verification.userName}")

            // Step 2: Generate Ed25519 keypair
            statusText = "יוצר מפתח אבטחה..."
            val (publicKey, _) = KeyManager.generateKeypair()
            val publicKeyBase64 = Base64.encodeToString(publicKey, Base64.NO_WRAP)
            Log.d("KeyPass", "Keypair generated")

            // Step 3: Register device with server
            statusText = "רושם את המכשיר..."
            val response = ApiClient.api.registerDevice(
                RegisterDeviceRequest(
                    token = token,
                    publicKey = publicKeyBase64,
                    deviceId = "android-${Build.BRAND}-${System.currentTimeMillis()}",
                    deviceName = "${Build.MANUFACTURER} ${Build.MODEL}",
                    platform = "android",
                    appVersion = BuildConfig.VERSION_NAME
                )
            )
            Log.d("KeyPass", "Device registered. Credential: ${response.credential?.id}")

            // Step 4: Save everything
            TokenManager.accessToken = response.accessToken
            TokenManager.refreshToken = response.refreshToken
            response.credential?.let { PrefsManager.credentialId = it.id }
            response.user?.let {
                PrefsManager.userId = it.id
                PrefsManager.userName = it.name
                PrefsManager.orgName = it.orgName
            }

            step = SetupStep.SUCCESS
        } catch (e: Exception) {
            Log.e("KeyPass", "Setup failed", e)
            error = "שגיאה: ${e.message}"
            step = SetupStep.ERROR
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        when (step) {
            SetupStep.REGISTERING -> {
                Surface(
                    modifier = Modifier.size(80.dp),
                    shape = RoundedCornerShape(20.dp),
                    color = KeyPassBlueLight
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("🔑", fontSize = 40.sp)
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
                CircularProgressIndicator(color = KeyPassBlue, modifier = Modifier.size(48.dp))
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    statusText,
                    style = MaterialTheme.typography.bodyLarge,
                    color = KeyPassGray
                )
            }

            SetupStep.SUCCESS -> {
                Surface(
                    modifier = Modifier.size(100.dp),
                    shape = RoundedCornerShape(50.dp),
                    color = KeyPassGreenLight
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("✓", fontSize = 48.sp, color = KeyPassGreen)
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    "המפתח שלך מוכן!",
                    style = MaterialTheme.typography.headlineMedium,
                    color = KeyPassDarkText
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "הצמד את הטלפון לקורא NFC ליד הדלת",
                    style = MaterialTheme.typography.bodyLarge,
                    color = KeyPassGray,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = onSetupComplete,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = KeyPassBlue)
                ) {
                    Text("התחל להשתמש", fontSize = 18.sp)
                }
            }

            SetupStep.ERROR -> {
                Surface(
                    modifier = Modifier.size(80.dp),
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xFFFEE2E2)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("✗", fontSize = 40.sp, color = KeyPassRed)
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    "שגיאה בהרשמה",
                    style = MaterialTheme.typography.headlineMedium,
                    color = KeyPassDarkText
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    error ?: "שגיאה לא ידועה",
                    style = MaterialTheme.typography.bodyLarge,
                    color = KeyPassRed,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "API: ${ApiClient.baseUrl}",
                    style = MaterialTheme.typography.bodySmall,
                    color = KeyPassGray,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = { step = SetupStep.REGISTERING },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = KeyPassBlue)
                ) {
                    Text("נסה שוב", fontSize = 18.sp)
                }
            }
        }
    }
}
