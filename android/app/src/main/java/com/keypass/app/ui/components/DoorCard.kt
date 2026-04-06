package com.keypass.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.keypass.app.network.DoorWithAccess
import com.keypass.app.ui.theme.*

@Composable
fun DoorCard(
    door: DoorWithAccess,
    onSimulateNfc: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        // Status bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .then(
                    if (door.isOnline) Modifier else Modifier
                )
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = if (door.isOnline) KeyPassGreen else KeyPassRed
            ) {}
        }

        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = door.name,
                    style = MaterialTheme.typography.titleLarge,
                    color = KeyPassDarkText
                )
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (door.isOnline) KeyPassGreenLight else Color(0xFFFEE2E2)
                ) {
                    Text(
                        text = if (door.isOnline) "מחובר" else "מנותק",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (door.isOnline) KeyPassGreen else KeyPassRed
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (door.lastAccess != null) {
                Text(
                    text = "כניסה אחרונה: ${door.lastAccess}",
                    style = MaterialTheme.typography.bodySmall,
                    color = KeyPassGray
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            Text(
                text = "הצמד את הטלפון לקורא NFC ליד הדלת",
                style = MaterialTheme.typography.bodyMedium,
                color = KeyPassGray,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            if (onSimulateNfc != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onSimulateNfc,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = KeyPassBlue)
                ) {
                    Text("🔓 סימולציית NFC", modifier = Modifier.padding(vertical = 4.dp))
                }
            }
        }
    }
}
