import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sensors_plus/sensors_plus.dart';

/// 기압계 기반 지하 층수 추정기.
///
/// 원리: 지하로 3m 내려갈 때마다 기압이 약 0.36 hPa 올라간다.
/// GPS 정확도가 좋을 때(=야외에 있을 때)의 기압을 "지상 기준"으로 삼고,
/// 이후 기압 변화량으로 몇 층 내려갔는지 계산한다.
///
/// 날씨 변화로 인한 기압 변동이 있으므로 결과는 "제안"으로만 쓰고
/// 사용자가 확인/수정하는 것을 전제로 한다.
class FloorEstimator {
  FloorEstimator._();
  static final FloorEstimator instance = FloorEstimator._();

  /// 해수면 부근 근사: 1 m 상승당 약 0.12 hPa 감소
  static const double hPaPerMeter = 0.12;

  /// 주차장 평균 층고(m)
  static const double metersPerFloor = 3.2;

  /// 기압계가 있는 기기인지 (스트림에서 첫 이벤트가 오면 true)
  final ValueNotifier<bool> available = ValueNotifier(false);

  /// 추정 층 (음수 = 지하). 기준 기압이 없으면 null.
  final ValueNotifier<int?> suggestedFloor = ValueNotifier(null);

  StreamSubscription<BarometerEvent>? _sub;
  double? _currentPressure;
  double? _groundPressure;
  DateTime? _groundAt;

  double? get currentPressure => _currentPressure;
  DateTime? get groundMarkedAt => _groundAt;

  void start() {
    if (_sub != null) return;
    try {
      _sub = barometerEventStream().listen(
        (e) {
          _currentPressure = e.pressure;
          if (!available.value) available.value = true;
          _recompute();
        },
        onError: (Object _) {
          available.value = false;
          suggestedFloor.value = null;
        },
        cancelOnError: true,
      );
    } catch (_) {
      available.value = false;
    }
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }

  /// 야외로 판단되는 순간(GPS 정확도 양호) 호출해 지상 기준 기압을 갱신한다.
  void markOutdoor() {
    if (_currentPressure == null) return;
    _groundPressure = _currentPressure;
    _groundAt = DateTime.now();
    _recompute();
  }

  void _recompute() {
    suggestedFloor.value =
        estimate(current: _currentPressure, ground: _groundPressure);
  }

  /// 순수 계산 로직 (단위 테스트용으로 분리).
  /// 반환: 음수 = 지하 n층, 양수 = 지상 n층(지면 = 1F), null = 판단 불가.
  static int? estimate({double? current, double? ground}) {
    if (current == null || ground == null) return null;
    final metersBelow = (current - ground) / hPaPerMeter; // +면 지하 방향
    final floorsBelow = (metersBelow / metersPerFloor).round();
    if (floorsBelow >= 1) {
      return -(floorsBelow > 10 ? 10 : floorsBelow); // B1 ~ B10
    }
    if (floorsBelow <= -1) {
      final up = 1 - floorsBelow; // 한 층 올라가면 2F
      return up > 20 ? 20 : up;
    }
    return 1; // 지면과 비슷하면 1F
  }
}
