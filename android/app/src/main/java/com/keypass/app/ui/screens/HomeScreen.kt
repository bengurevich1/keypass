package com.keypass.app.ui.screens

import android.content.Context
import android.content.Intent
import android.nfc.NfcAdapter
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Nfc
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import com.keypass.app.data.PrefsManager
import com.keypass.app.network.ApiClient
import com.keypass.app.network.DoorWithAccess
import com.keypass.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun HomeScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var doors by remember { mutableStateOf<List<DoorWithAccess>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    val nfcAdapter = remember { NfcAdapter.getDefaultAdapter(context) }
    val nfcEnabled = remember { nfcAdapter?.isEnabled == true }

    fun loadDoors() {
        scope.launch {
            try {
                doors = ApiClient.api.getDoors()
            } catch (_: Exception) {}
            finally {
                loading = false
                refreshing = false
            }
        }
    }

    LaunchedEffect(Unit) { loadDoors() }

    Column(modifier = Modifier.fillMaxSize()) {
        // Header
        Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 2.dp) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp).padding(top = 40.dp)) {
                Text(
                    "שלום, ${PrefsManager.userName ?: ""}",
                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                    color = KeyPassDarkText
                )
                Text(
                    PrefsManager.orgName ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = KeyPassGray
                )
            }
        }

        // NFC Banner
        if (nfcAdapter == null) {
            NfcBanner("המכשיר לא תומך ב-NFC", Color(0xFFFEE2E2), KeyPassRed, null)
        } else if (!nfcEnabled) {
            NfcBanner("NFC כבוי — הפעל בהגדרות", Color(0xFFFEF3C7), Color(0xFFD97706), context)
        }

        // Content
        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = KeyPassBlue)
            }
        } else {
            SwipeRefresh(
                state = rememberSwipeRefreshState(refreshing),
                onRefresh = { refreshing = true; loadDoors() }
            ) {
                if (doors.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(48.dp), tint = KeyPassGray)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("אין דלתות מוקצות", color = KeyPassGray, textAlign = TextAlign.Center)
                            Text("פנה למנהל הבניין", color = KeyPassGray, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(doors) { door ->
                            DoorCardFull(door = door, context = context)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NfcBanner(text: String, bgColor: Color, textColor: Color, context: Context?) {
    Surface(color = bgColor, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = textColor, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(text, color = textColor, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
            if (context != null) {
                TextButton(onClick = {
                    context.startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
                }) {
                    Text("הגדרות", color = textColor, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun DoorCardFull(door: DoorWithAccess, context: Context) {
    val scope = rememberCoroutineScope()
    var unlockState by remember { mutableStateOf<String?>(null) } // null, "unlocking", "success", "error"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        // Status bar
        Surface(
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = if (door.isOnline) KeyPassGreen else KeyPassRed
        ) {}

        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status badge
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (door.isOnline) KeyPassGreenLight else Color(0xFFFEE2E2)
                ) {
                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(modifier = Modifier.size(8.dp), shape = RoundedCornerShape(4.dp), color = if (door.isOnline) KeyPassGreen else KeyPassRed) {}
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            if (door.isOnline) "מחובר" else "מנותק",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (door.isOnline) KeyPassGreen else KeyPassRed
                        )
                    }
                }

                // Door name
                Text(
                    door.name,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = KeyPassDarkText
                )
            }

            if (door.description != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(door.description, style = MaterialTheme.typography.bodySmall, color = KeyPassGray)
            }

            if (door.lastAccess != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "כניסה אחרונה: ${door.lastAccess}",
                    style = MaterialTheme.typography.bodySmall,
                    color = KeyPassGray
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // NFC info
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFF8FAFC)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(Icons.Default.Nfc, contentDescription = null, tint = KeyPassGray, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("הצמד את הטלפון לקורא NFC", style = MaterialTheme.typography.bodySmall, color = KeyPassGray)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Mock unlock button
            val btnColor = when (unlockState) {
                "success" -> KeyPassGreen
                "error" -> KeyPassRed
                else -> KeyPassBlue
            }
            val btnText = when (unlockState) {
                "unlocking" -> "פותח..."
                "success" -> "✓ נפתח!"
                "error" -> "✗ שגיאה"
                else -> "🔓 סימולציית NFC"
            }

            Button(
                onClick = {
                    if (unlockState == "unlocking") return@Button
                    scope.launch {
                        unlockState = "unlocking"
                        try {
                            ApiClient.api.mockUnlock(door.id)
                            unlockState = "success"
                            // Vibrate
                            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                vibrator?.vibrate(VibrationEffect.createOneShot(200, VibrationEffect.DEFAULT_AMPLITUDE))
                            }
                        } catch (_: Exception) {
                            unlockState = "error"
                        }
                        delay(2000)
                        unlockState = null
                    }
                },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = btnColor),
                enabled = unlockState != "unlocking"
            ) {
                if (unlockState == "unlocking") {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(btnText, fontSize = 16.sp)
            }
        }
    }
}
