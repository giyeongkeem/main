package kr.vfar.eodijucha

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * 차량(오디오 계열) 블루투스 연결이 끊기는 순간 = 주차 직후일 가능성이 높다.
 * "방금 주차하셨나요?" 알림을 띄우고, 탭하면 앱이 빠른저장 모드로 열린다.
 */
class BtDisconnectReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != BluetoothDevice.ACTION_ACL_DISCONNECTED) return

        val device: BluetoothDevice? = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        }

        // 오디오/차량 계열 기기만 반응. 권한 문제로 조회가 안 되면 일단 알림.
        val isCarLike = try {
            val major = device?.bluetoothClass?.majorDeviceClass
            major == null || major == BluetoothClass.Device.Major.AUDIO_VIDEO
        } catch (e: SecurityException) {
            true
        }
        if (!isCarLike) return

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "주차 감지", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "차량 블루투스 해제 시 주차 위치 기록을 제안합니다" }
            )
        }

        val open = Intent(context, MainActivity::class.java).apply {
            putExtra(MainActivity.EXTRA_QUICK, true)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(
            context, 1001, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION") Notification.Builder(context)
        }
        val notification = builder
            .setSmallIcon(context.applicationInfo.icon)
            .setContentTitle("방금 주차하셨나요? 🅿️")
            .setContentText("탭하면 위치를 자동으로 기록해요")
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()

        try {
            nm.notify(NOTIFICATION_ID, notification)
        } catch (e: SecurityException) {
            // 알림 권한 미허용 — 조용히 무시
        }
    }

    companion object {
        private const val CHANNEL_ID = "parking"
        private const val NOTIFICATION_ID = 2001
    }
}
