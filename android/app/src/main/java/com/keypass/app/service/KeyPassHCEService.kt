package com.keypass.app.service

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import com.keypass.app.crypto.KeyManager
import com.keypass.app.data.PrefsManager

/**
 * NFC Host Card Emulation service for KeyPass.
 *
 * APDU Protocol:
 * 1. SELECT AID: 00 A4 04 00 08 F04B455950415353
 *    → Response: 90 00 (OK)
 *
 * 2. GET CHALLENGE: 80 CA 00 00 20
 *    → Reader sends 32-byte challenge in a subsequent command
 *
 * 3. AUTHENTICATE: 80 88 00 00 XX {challenge_bytes}
 *    → Service signs challenge with Ed25519 private key
 *    → Response: {16 bytes credential_id} + {64 bytes signature} + 90 00
 *
 * 4. Reader verifies signature → opens door
 */
class KeyPassHCEService : HostApduService() {

    companion object {
        private const val TAG = "KeyPassHCE"

        // Our custom AID: F0 + "KEYPASS" in hex
        private val KEYPASS_AID = byteArrayOf(
            0xF0.toByte(), 0x4B, 0x45, 0x59, 0x50, 0x41, 0x53, 0x53
        )

        // APDU command classes and instructions
        private const val CLA_ISO = 0x00.toByte()
        private const val CLA_PROPRIETARY = 0x80.toByte()
        private const val INS_SELECT = 0xA4.toByte()
        private const val INS_GET_CHALLENGE = 0xCA.toByte()
        private const val INS_AUTHENTICATE = 0x88.toByte()

        // Status words
        private val SW_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_FILE_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
        private val SW_CONDITIONS_NOT_SATISFIED = byteArrayOf(0x69.toByte(), 0x85.toByte())
        private val SW_WRONG_LENGTH = byteArrayOf(0x67.toByte(), 0x00)
        private val SW_INS_NOT_SUPPORTED = byteArrayOf(0x6D.toByte(), 0x00)
    }

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        if (commandApdu.size < 4) {
            return SW_WRONG_LENGTH
        }

        val cla = commandApdu[0]
        val ins = commandApdu[1]

        Log.d(TAG, "Received APDU: CLA=${cla.toHex()} INS=${ins.toHex()} len=${commandApdu.size}")

        return when {
            // SELECT AID command
            cla == CLA_ISO && ins == INS_SELECT -> handleSelect(commandApdu)

            // GET CHALLENGE (reader requests our credential info)
            cla == CLA_PROPRIETARY && ins == INS_GET_CHALLENGE -> handleGetChallenge()

            // AUTHENTICATE (reader sends challenge, we sign it)
            cla == CLA_PROPRIETARY && ins == INS_AUTHENTICATE -> handleAuthenticate(commandApdu)

            else -> {
                Log.w(TAG, "Unsupported instruction: ${ins.toHex()}")
                SW_INS_NOT_SUPPORTED
            }
        }
    }

    private fun handleSelect(apdu: ByteArray): ByteArray {
        // Verify the AID matches
        if (apdu.size < 5 + KEYPASS_AID.size) {
            return SW_WRONG_LENGTH
        }

        val aidOffset = 5 // CLA + INS + P1 + P2 + Lc
        val receivedAid = apdu.copyOfRange(aidOffset, aidOffset + KEYPASS_AID.size)

        if (!receivedAid.contentEquals(KEYPASS_AID)) {
            Log.w(TAG, "AID mismatch")
            return SW_FILE_NOT_FOUND
        }

        // Check if user is registered
        if (!PrefsManager.isRegistered) {
            Log.w(TAG, "User not registered")
            return SW_CONDITIONS_NOT_SATISFIED
        }

        Log.d(TAG, "SELECT AID OK — KeyPass card selected")
        return SW_OK
    }

    private fun handleGetChallenge(): ByteArray {
        if (!PrefsManager.isRegistered) {
            return SW_CONDITIONS_NOT_SATISFIED
        }

        // Return credential ID (16 bytes) so reader knows which user is tapping
        return try {
            val credentialId = KeyManager.getCredentialId()
            Log.d(TAG, "GET CHALLENGE — returning credential ID (${credentialId.size} bytes)")
            credentialId + SW_OK
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get credential ID", e)
            SW_CONDITIONS_NOT_SATISFIED
        }
    }

    private fun handleAuthenticate(apdu: ByteArray): ByteArray {
        if (!PrefsManager.isRegistered) {
            return SW_CONDITIONS_NOT_SATISFIED
        }

        // Extract challenge from APDU data
        // Format: CLA(1) + INS(1) + P1(1) + P2(1) + Lc(1) + Data(Lc)
        if (apdu.size < 6) {
            return SW_WRONG_LENGTH
        }

        val dataLength = apdu[4].toInt() and 0xFF
        if (apdu.size < 5 + dataLength) {
            return SW_WRONG_LENGTH
        }

        val challenge = apdu.copyOfRange(5, 5 + dataLength)
        Log.d(TAG, "AUTHENTICATE — received ${challenge.size} byte challenge")

        return try {
            // Sign the challenge with our Ed25519 private key
            val signature = KeyManager.sign(challenge)
            val credentialId = KeyManager.getCredentialId()

            Log.d(TAG, "AUTHENTICATE — signed successfully (sig=${signature.size} bytes, cred=${credentialId.size} bytes)")

            // Response: credential_id (16 bytes) + signature (64 bytes) + SW_OK
            credentialId + signature + SW_OK
        } catch (e: Exception) {
            Log.e(TAG, "Authentication failed", e)
            SW_CONDITIONS_NOT_SATISFIED
        }
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "HCE service deactivated, reason=$reason")
    }

    private fun Byte.toHex(): String = String.format("%02X", this)
}
