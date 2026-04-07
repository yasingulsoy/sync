package com.hospisync.signage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Cihaz yeniden başladığında uygulamayı açar (üretici / ROM ayarlarına bağlı olarak
 * pil optimizasyonu kapalı olmalıdır).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val a = intent?.action ?: return
        val boot = a == Intent.ACTION_BOOT_COMPLETED ||
            a == "android.intent.action.QUICKBOOT_POWERON" ||
            a == "com.htc.intent.action.QUICKBOOT_POWERON"
        if (!boot) return
        val launch = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(launch)
    }
}
