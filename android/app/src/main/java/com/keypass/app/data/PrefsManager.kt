package com.keypass.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object PrefsManager {
    private const val PREFS_NAME = "keypass_secure_prefs"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        prefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var privateKey: String?
        get() = prefs.getString("private_key", null)
        set(value) = prefs.edit().putString("private_key", value).apply()

    var publicKey: String?
        get() = prefs.getString("public_key", null)
        set(value) = prefs.edit().putString("public_key", value).apply()

    var credentialId: String?
        get() = prefs.getString("credential_id", null)
        set(value) = prefs.edit().putString("credential_id", value).apply()

    var userId: String?
        get() = prefs.getString("user_id", null)
        set(value) = prefs.edit().putString("user_id", value).apply()

    var userName: String?
        get() = prefs.getString("user_name", null)
        set(value) = prefs.edit().putString("user_name", value).apply()

    var orgName: String?
        get() = prefs.getString("org_name", null)
        set(value) = prefs.edit().putString("org_name", value).apply()

    var serverUrl: String?
        get() = prefs.getString("server_url", null)
        set(value) = prefs.edit().putString("server_url", value).apply()

    val isRegistered: Boolean
        get() = !credentialId.isNullOrEmpty()

    fun clear() {
        prefs.edit().clear().apply()
    }
}
