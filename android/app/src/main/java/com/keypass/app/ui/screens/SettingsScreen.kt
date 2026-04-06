package com.keypass.app.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.nfc.NfcAdapter
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.keypass.app.BuildConfig
import com.keypass.app.data.PrefsManager
import com.keypass.app.data.TokenManager
import com.keypass.app.network.ApiClient
import com.keypass.app.network.ProfileResponse
import com.keypass.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(onLogout: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var profile by remember { mutableStateOf<ProfileResponse?>(null) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    val nfcEnabled = remember { NfcAdapter.getDefaultAdapter(context)?.isEnabled == true }

    LaunchedEffect(Unit) {
        try {
            profile = ApiClient.api.getProfile()
        } catch (_: Exception) {}
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 2.dp
        ) {
            Column(modifier = Modifier.padding(20.dp).padding(top = 40.dp)) {
                Text(
                    "הגדרות",
                    style = MaterialTheme.typography.headlineSmall,
                    color = KeyPassDarkText
                )
            }
        }

        Column(modifier = Modifier.padding(16.dp)) {
            // Profile Card
            SettingsCard(title = "הפרופיל שלי") {
                SettingsRow("שם", profile?.name ?: PrefsManager.userName ?: "—")
                SettingsRow("טלפון", profile?.phone ?: "—")
                profile?.apartment?.let { SettingsRow("דירה", it) }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Organization Card
            SettingsCard(title = "ארגון") {
                SettingsRow("שם", profile?.orgName ?: PrefsManager.orgName ?: "—")
                SettingsRow("דלתות", "${profile?.doors?.size ?: 0}")
            }

            Spacer(modifier = Modifier.height(12.dp))

            // NFC & App Info
            SettingsCard(title = "אודות") {
                SettingsRow("NFC", if (nfcEnabled) "פעיל ✓" else "כבוי")
                SettingsRow("גרסה", BuildConfig.VERSION_NAME)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Contact Support
            OutlinedButton(
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/972501234567?text=שלום, אני צריך עזרה עם KeyPass"))
                    context.startActivity(intent)
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("📱 צור קשר", modifier = Modifier.padding(vertical = 4.dp))
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Logout
            OutlinedButton(
                onClick = {
                    TokenManager.clear()
                    PrefsManager.clear()
                    onLogout()
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("התנתק", modifier = Modifier.padding(vertical = 4.dp), color = KeyPassGray)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Delete Account
            OutlinedButton(
                onClick = { showDeleteDialog = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = KeyPassRed)
            ) {
                Text("מחק חשבון", modifier = Modifier.padding(vertical = 4.dp))
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("מחיקת חשבון") },
            text = { Text("האם אתה בטוח? פעולה זו לא ניתנת לביטול.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            try {
                                ApiClient.api.deleteAccount()
                                TokenManager.clear()
                                PrefsManager.clear()
                                onLogout()
                            } catch (_: Exception) {}
                        }
                    }
                ) {
                    Text("מחק", color = KeyPassRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("ביטול")
                }
            }
        )
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                color = KeyPassDarkText
            )
            Spacer(modifier = Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun SettingsRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = KeyPassGray)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = KeyPassDarkText)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
}
