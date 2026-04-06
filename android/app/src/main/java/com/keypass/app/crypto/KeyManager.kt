package com.keypass.app.crypto

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.Sign
import com.goterl.lazysodium.utils.KeyPair
import com.keypass.app.data.PrefsManager
import java.util.UUID

object KeyManager {
    private val lazySodium = LazySodiumAndroid(SodiumAndroid())

    fun generateKeypair(): Pair<ByteArray, ByteArray> {
        val keyPair: KeyPair = (lazySodium as Sign.Lazy).cryptoSignKeypair()
        val publicKey = keyPair.publicKey.asBytes
        val privateKey = keyPair.secretKey.asBytes

        PrefsManager.publicKey = Base64.encodeToString(publicKey, Base64.NO_WRAP)
        PrefsManager.privateKey = Base64.encodeToString(privateKey, Base64.NO_WRAP)

        return Pair(publicKey, privateKey)
    }

    fun sign(challenge: ByteArray): ByteArray {
        val privateKeyStr = PrefsManager.privateKey
            ?: throw IllegalStateException("Private key not found")
        val privateKey = Base64.decode(privateKeyStr, Base64.NO_WRAP)

        val signature = ByteArray(Sign.ED25519_BYTES)

        // lazysodium-android 5.x Native signature:
        // cryptoSignDetached(sig: ByteArray, message: ByteArray, messageLen: Long, secretKey: ByteArray): Boolean
        val success = (lazySodium as Sign.Native).cryptoSignDetached(
            signature,
            challenge,
            challenge.size.toLong(),
            privateKey
        )

        if (!success) throw IllegalStateException("Signing failed")
        return signature
    }

    fun getPublicKey(): ByteArray {
        val publicKeyStr = PrefsManager.publicKey
            ?: throw IllegalStateException("Public key not found")
        return Base64.decode(publicKeyStr, Base64.NO_WRAP)
    }

    fun getPublicKeyBase64(): String {
        return PrefsManager.publicKey
            ?: throw IllegalStateException("Public key not found")
    }

    fun getCredentialId(): ByteArray {
        val credId = PrefsManager.credentialId
            ?: throw IllegalStateException("Credential ID not found")
        return uuidToBytes(credId)
    }

    fun getCredentialIdString(): String {
        return PrefsManager.credentialId
            ?: throw IllegalStateException("Credential ID not found")
    }

    private fun uuidToBytes(uuid: String): ByteArray {
        val parsed = UUID.fromString(uuid)
        val bytes = ByteArray(16)
        var msb = parsed.mostSignificantBits
        var lsb = parsed.leastSignificantBits
        for (i in 0..7) {
            bytes[7 - i] = (msb and 0xFF).toByte()
            msb = msb shr 8
        }
        for (i in 0..7) {
            bytes[15 - i] = (lsb and 0xFF).toByte()
            lsb = lsb shr 8
        }
        return bytes
    }
}
