/// 주차 기록 한 건.
/// [floor]는 정수 하나로 층을 표현한다: 음수 = 지하(B2 → -2), 양수 = 지상(3F → 3). 0은 쓰지 않는다.
class ParkingRecord {
  final int id;
  final DateTime ts;
  final int floor;
  final String zone;
  final String building;
  final String memo;
  final String? photoPath;
  final double? lat;
  final double? lng;
  final double? accuracy;

  const ParkingRecord({
    required this.id,
    required this.ts,
    required this.floor,
    this.zone = '',
    this.building = '',
    this.memo = '',
    this.photoPath,
    this.lat,
    this.lng,
    this.accuracy,
  });

  bool get isBasement => floor < 0;
  bool get hasGps => lat != null && lng != null;

  String get floorText => floor < 0 ? 'B${-floor}' : '${floor}F';
  String get floorKorean => floor < 0 ? '지하 ${-floor}층' : '지상 $floor층';

  /// "건물 · 구역" 조합 (둘 다 없으면 빈 문자열)
  String get placeLine =>
      [building, zone].where((s) => s.isNotEmpty).join(' · ');

  Map<String, dynamic> toJson() => {
        'id': id,
        'ts': ts.millisecondsSinceEpoch,
        'floor': floor,
        'zone': zone,
        'building': building,
        'memo': memo,
        'photoPath': photoPath,
        'lat': lat,
        'lng': lng,
        'accuracy': accuracy,
      };

  factory ParkingRecord.fromJson(Map<String, dynamic> j) => ParkingRecord(
        id: j['id'] as int,
        ts: DateTime.fromMillisecondsSinceEpoch(j['ts'] as int),
        floor: j['floor'] as int,
        zone: (j['zone'] as String?) ?? '',
        building: (j['building'] as String?) ?? '',
        memo: (j['memo'] as String?) ?? '',
        photoPath: j['photoPath'] as String?,
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        accuracy: (j['accuracy'] as num?)?.toDouble(),
      );

  ParkingRecord copyWith({String? photoPath}) => ParkingRecord(
        id: id,
        ts: ts,
        floor: floor,
        zone: zone,
        building: building,
        memo: memo,
        photoPath: photoPath ?? this.photoPath,
        lat: lat,
        lng: lng,
        accuracy: accuracy,
      );
}

String formatDateTime(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}.${two(d.month)}.${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
}

String formatElapsed(Duration e) {
  if (e.inDays > 0) return '${e.inDays}일 ${e.inHours % 24}시간 경과';
  if (e.inHours > 0) return '${e.inHours}시간 ${e.inMinutes % 60}분 경과';
  return '${e.inMinutes}분 경과';
}
