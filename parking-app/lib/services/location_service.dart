import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

class PlaceInfo {
  final String? name; // 건물/장소 이름
  final String? address; // 짧은 주소
  const PlaceInfo(this.name, this.address);
}

class LocationService {
  LocationService._();

  static bool _localeSet = false;

  /// 위치 권한을 확인/요청하고 현재 좌표를 반환. 실패 시 null.
  static Future<Position?> getPosition() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  /// 좌표 → 건물/장소 이름 + 짧은 주소 (기기 내장 지오코더, 오프라인 불가 시 null들)
  static Future<PlaceInfo> reverseGeocode(double lat, double lng) async {
    try {
      if (!_localeSet) {
        await setLocaleIdentifier('ko_KR');
        _localeSet = true;
      }
      final placemarks = await placemarkFromCoordinates(lat, lng);
      if (placemarks.isEmpty) return const PlaceInfo(null, null);
      final p = placemarks.first;
      String? clean(String? s) => (s == null || s.trim().isEmpty) ? null : s.trim();
      final name = clean(p.name);
      final addr = [p.locality, p.subLocality, p.thoroughfare]
          .map(clean)
          .whereType<String>()
          .join(' ');
      return PlaceInfo(name, addr.isEmpty ? null : addr);
    } catch (_) {
      return const PlaceInfo(null, null);
    }
  }
}
