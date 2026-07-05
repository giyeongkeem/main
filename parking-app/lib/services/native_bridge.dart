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
}
