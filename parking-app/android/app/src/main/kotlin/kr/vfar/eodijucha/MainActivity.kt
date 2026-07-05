package kr.vfar.eodijucha

import android.content.Intent
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
                    else -> result.notImplemented()
                }
            }
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
