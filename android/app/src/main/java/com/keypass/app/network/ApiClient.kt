package com.keypass.app.network

import com.keypass.app.BuildConfig
import com.keypass.app.data.PrefsManager
import com.keypass.app.data.TokenManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

// DTOs
data class VerifyTokenRequest(val token: String)
data class VerifyTokenResponse(val valid: Boolean, val userName: String?, val phoneMask: String)

data class SendOtpRequest(val token: String)
data class SendOtpResponse(val message: String, val phoneMask: String)

data class VerifyOtpRequest(val token: String, val otp: String)
data class VerifyOtpResponse(val message: String, val sessionToken: String, val token: String)

data class RegisterDeviceRequest(
    val token: String,
    val publicKey: String,
    val deviceId: String,
    val deviceName: String,
    val platform: String,
    val appVersion: String
)

data class RegisterDeviceResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: UserInfo?,
    val credential: CredentialInfo?
)

data class UserInfo(
    val id: String,
    val name: String?,
    val phone: String?,
    val orgName: String?
)

data class CredentialInfo(val id: String)

data class RefreshRequest(val refreshToken: String)
data class RefreshResponse(val accessToken: String, val refreshToken: String)

data class ProfileResponse(
    val id: String,
    val name: String?,
    val phone: String?,
    val apartment: String?,
    val email: String?,
    val orgName: String?,
    val doors: List<DoorInfo>
)

data class DoorInfo(
    val id: String,
    val name: String,
    val description: String?,
    val isOnline: Boolean,
    val lastSeenAt: String?
)

data class DoorWithAccess(
    val id: String,
    val name: String,
    val description: String?,
    val isOnline: Boolean,
    val lastSeenAt: String?,
    val lastAccess: String?
)

data class AccessLog(
    val id: Long,
    val doorName: String?,
    val action: String,
    val method: String?,
    val timestamp: String?
)

data class HistoryResponse(
    val data: List<AccessLog>,
    val total: Int,
    val page: Int,
    val limit: Int
)

data class WalletSignRequest(val platform: String)
data class WalletSignResponse(val url: String)
data class WalletStatusResponse(val google: Boolean, val apple: Boolean)

interface KeyPassApi {
    @POST("auth/send-otp")
    suspend fun sendOtp(@Body body: SendOtpRequest): SendOtpResponse

    @POST("auth/verify-token")
    suspend fun verifyToken(@Body body: VerifyTokenRequest): VerifyTokenResponse

    @POST("auth/verify-otp")
    suspend fun verifyOtp(@Body body: VerifyOtpRequest): VerifyOtpResponse

    @POST("auth/register-device")
    suspend fun registerDevice(@Body body: RegisterDeviceRequest): RegisterDeviceResponse

    @POST("auth/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): RefreshResponse

    @GET("mobile/me")
    suspend fun getProfile(): ProfileResponse

    @GET("mobile/doors")
    suspend fun getDoors(): List<DoorWithAccess>

    @POST("mobile/doors/{id}/mock-unlock")
    suspend fun mockUnlock(@Path("id") doorId: String): Map<String, Any>

    @GET("mobile/history")
    suspend fun getHistory(@Query("page") page: Int = 1, @Query("limit") limit: Int = 20): HistoryResponse

    @DELETE("mobile/me")
    suspend fun deleteAccount(): Map<String, String>

    @POST("wallet/sign")
    suspend fun signWalletLink(@Body body: WalletSignRequest): WalletSignResponse

    @GET("wallet/status")
    suspend fun walletStatus(): WalletStatusResponse
}

object ApiClient {
    // Dynamic base URL — set from deep link, falls back to BuildConfig
    var baseUrl: String = BuildConfig.API_BASE_URL
        private set

    fun setBaseUrl(url: String) {
        if (url.isNotBlank()) {
            baseUrl = url.trimEnd('/')
            _api = null // Force rebuild
        }
    }

    private val authInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
        TokenManager.accessToken?.let {
            request.addHeader("Authorization", "Bearer $it")
        }
        chain.proceed(request.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                else HttpLoggingInterceptor.Level.NONE
    }

    private val client = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .build()

    private var _api: KeyPassApi? = null

    val api: KeyPassApi
        get() {
            if (_api == null) {
                _api = Retrofit.Builder()
                    .baseUrl("$baseUrl/api/")
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()
                    .create(KeyPassApi::class.java)
            }
            return _api!!
        }
}
