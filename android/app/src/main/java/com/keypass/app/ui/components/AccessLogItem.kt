package com.keypass.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.keypass.app.network.AccessLog
import com.keypass.app.ui.theme.*

@Composable
fun AccessLogItem(log: AccessLog, modifier: Modifier = Modifier) {
    val isSuccess = log.action == "unlock" || log.action == "remote_unlock"
    val dotColor = if (isSuccess) KeyPassGreen else KeyPassRed
    val actionLabel = when (log.action) {
        "unlock" -> "נפתח"
        "denied" -> "נדחה"
        "remote_unlock" -> "פתיחה מרחוק"
        else -> log.action
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(10.dp),
                shape = CircleShape,
                color = dotColor
            ) {}

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = log.doorName ?: "דלת",
                        style = MaterialTheme.typography.bodyLarge,
                        color = KeyPassDarkText
                    )
                    Text(
                        text = actionLabel,
                        style = MaterialTheme.typography.bodyMedium,
                        color = dotColor
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = buildString {
                        log.timestamp?.let { append(it) }
                        log.method?.let { append(" • $it") }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = KeyPassGray
                )
            }
        }
    }
}
