package com.keypass.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.google.accompanist.swiperefresh.SwipeRefresh
import com.google.accompanist.swiperefresh.rememberSwipeRefreshState
import com.keypass.app.network.AccessLog
import com.keypass.app.network.ApiClient
import com.keypass.app.ui.components.AccessLogItem
import com.keypass.app.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun HistoryScreen() {
    val scope = rememberCoroutineScope()
    var logs by remember { mutableStateOf<List<AccessLog>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var refreshing by remember { mutableStateOf(false) }
    var page by remember { mutableIntStateOf(1) }
    var hasMore by remember { mutableStateOf(true) }

    fun loadHistory(p: Int = 1, append: Boolean = false) {
        scope.launch {
            try {
                val response = ApiClient.api.getHistory(page = p)
                if (append) {
                    logs = logs + response.data
                } else {
                    logs = response.data
                }
                hasMore = response.data.size == 20
                page = p
            } catch (_: Exception) {}
            finally {
                loading = false
                refreshing = false
            }
        }
    }

    LaunchedEffect(Unit) { loadHistory() }

    Column(modifier = Modifier.fillMaxSize()) {
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 2.dp
        ) {
            Column(modifier = Modifier.padding(20.dp).padding(top = 40.dp)) {
                Text(
                    "היסטוריית כניסות",
                    style = MaterialTheme.typography.headlineSmall,
                    color = KeyPassDarkText
                )
            }
        }

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = KeyPassBlue)
            }
        } else {
            SwipeRefresh(
                state = rememberSwipeRefreshState(refreshing),
                onRefresh = { refreshing = true; loadHistory() }
            ) {
                if (logs.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("אין היסטוריה", color = KeyPassGray, textAlign = TextAlign.Center)
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(logs) { log ->
                            AccessLogItem(log = log)
                        }

                        if (hasMore) {
                            item {
                                TextButton(
                                    onClick = { loadHistory(page + 1, append = true) },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("טען עוד")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
