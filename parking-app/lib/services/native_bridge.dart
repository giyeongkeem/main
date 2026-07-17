import 'package:flutter/services.dart';

/// 안드로이드 네이티브(블루투스 해제 알림 → 앱 실행)와의 다리.
/// iOS에는 해당 채널이 없으므로 조용히 false를 돌려준다.
class NativeBridge {
  NativeBridge._();

  static const _channel = MethodChannel('eodijucha/native');

  /// 블루투스 해제 알림을 탭해서 앱이 열렸는지 확인(1회성 플래그 소비).
  static Future<bool> consumeQuickLaunch() async {
    try {
      return await _channel.invokeMethod<bool>('consumeQuickLaunch') ?? false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  /// 주차 감지(알림·블루투스) 런타임 권한 요청 — Android 12+/13+에서 필수.
  /// iOS/미지원 환경에서는 조용히 무시된다.
  static Future<void> requestParkingPermissions() async {
    try {
      await _channel.invokeMethod<bool>('requestParkingPermissions');
    } on MissingPluginException {
      // iOS 등 채널 없음 — 무시
    } on PlatformException {
      // 권한 요청 실패 — 무시 (알림 기능만 비활성)
    }
  }
}
