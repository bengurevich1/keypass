package com.keypass.app

import android.app.Application

class KeyPassApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: KeyPassApp
            private set
    }
}
