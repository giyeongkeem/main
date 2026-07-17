package kr.vfar.eodijucha

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var pendingQuick = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        if (intent?.getBooleanExtra(EXTRA_QUICK, false) == true) pendingQuick = true
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // 블루투스 해제 알림을 탭해서 열렸는지 — 1회성 플래그 소비
                    "consumeQuickLaunch" -> {
                        result.success(pendingQuick)
                        pendingQuick = false
                    }
                    // 주차 감지에 필요한 런타임 권한 요청 (알림: 13+, 블루투스: 12+)
                    "requestParkingPermissions" -> {
                        requestParkingPermissions()
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun requestParkingPermissions() {
        if (Build.VERSION.SDK_INT < 23) return
        val wanted = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= 31 &&
            checkSelfPermission("android.permission.BLUETOOTH_CONNECT") != PackageManager.PERMISSION_GRANTED
        ) wanted.add("android.permission.BLUETOOTH_CONNECT")
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED
        ) wanted.add("android.permission.POST_NOTIFICATIONS")
        if (wanted.isNotEmpty()) requestPermissions(wanted.toTypedArray(), 100)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra(EXTRA_QUICK, false)) pendingQuick = true
        setIntent(intent)
    }

    companion object {
        const val CHANNEL = "eodijucha/native"
        const val EXTRA_QUICK = "quick"
    }
}
