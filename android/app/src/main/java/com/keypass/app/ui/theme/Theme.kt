package com.keypass.app.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val KeyPassBlue = Color(0xFF2563EB)
val KeyPassBlueLight = Color(0xFFEFF6FF)
val KeyPassGreen = Color(0xFF16A34A)
val KeyPassGreenLight = Color(0xFFDCFCE7)
val KeyPassRed = Color(0xFFEF4444)
val KeyPassGray = Color(0xFF64748B)
val KeyPassDarkText = Color(0xFF1E293B)
val KeyPassBackground = Color(0xFFF8FAFC)

private val LightColorScheme = lightColorScheme(
    primary = KeyPassBlue,
    onPrimary = Color.White,
    primaryContainer = KeyPassBlueLight,
    secondary = KeyPassGreen,
    background = KeyPassBackground,
    surface = Color.White,
    onBackground = KeyPassDarkText,
    onSurface = KeyPassDarkText,
    error = KeyPassRed,
)

@Composable
fun KeyPassTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
