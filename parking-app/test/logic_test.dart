import 'package:flutter_test/flutter_test.dart';

import 'package:eodijucha/models/parking_record.dart';
import 'package:eodijucha/services/floor_estimator.dart';
import 'package:eodijucha/services/ocr_service.dart';

void main() {
  group('OcrService.parse — 층수/구역 추출', () {
    test('영문 지하 + 구역', () {
      final r = OcrService.parse('B3\nC-14');
      expect(r.floor, -3);
      expect(r.zone, 'C-14');
    });

    test('한글 지하 표기 우선', () {
      final r = OcrService.parse('지하 3층 주차장 B존');
      expect(r.floor, -3);
    });

    test('지상 층 (3F)', () {
      final r = OcrService.parse('3F  A-1');
      expect(r.floor, 3);
      expect(r.zone, 'A-1');
    });

    test('한글 지상 층 (4층)', () {
      final r = OcrService.parse('4층 F-07');
      expect(r.floor, 4);
      expect(r.zone, 'F-07');
    });

    test('B-3 하이픈 표기는 층수(B3)와 겹치면 구역으로 안 잡음', () {
      final r = OcrService.parse('B3 구역 B-3');
      expect(r.floor, -3);
      expect(r.zone, isNull);
    });

    test('띄어쓰기 있는 B 2 + 두 글자 구역', () {
      final r = OcrService.parse('SUB LEVEL B 2 zone GA-102');
      expect(r.floor, -2);
      expect(r.zone, 'GA-102');
    });

    test('한글 구역 (가-3)', () {
      final r = OcrService.parse('지하2층 가-3');
      expect(r.floor, -2);
      expect(r.zone, '가-3');
    });

    test('아무것도 없으면 비어 있음', () {
      final r = OcrService.parse('hello world 123456');
      expect(r.isEmpty, isTrue);
    });

    test('범위 밖 층수는 잘라냄', () {
      expect(OcrService.parse('B99').floor, -10);
    });
  });

  group('FloorEstimator.estimate — 기압 → 층수', () {
    // 1층 = 3.2m = 0.384 hPa
    test('기준 없으면 null', () {
      expect(FloorEstimator.estimate(current: 1013, ground: null), isNull);
    });

    test('지상과 같으면 1F', () {
      expect(FloorEstimator.estimate(current: 1013.0, ground: 1013.0), 1);
    });

    test('지하 3층 (기압 +1.15 hPa)', () {
      expect(FloorEstimator.estimate(current: 1014.15, ground: 1013.0), -3);
    });

    test('지하 1층 경계', () {
      expect(FloorEstimator.estimate(current: 1013.4, ground: 1013.0), -1);
    });

    test('지상 2층 (기압 -0.38 hPa)', () {
      expect(FloorEstimator.estimate(current: 1012.62, ground: 1013.0), 2);
    });

    test('지하 10층 초과는 B10으로 클램프', () {
      expect(FloorEstimator.estimate(current: 1020.0, ground: 1013.0), -10);
    });
  });

  group('ParkingRecord — 직렬화/표시', () {
    test('JSON 왕복', () {
      final r = ParkingRecord(
        id: 1,
        ts: DateTime.fromMillisecondsSinceEpoch(1751700000000),
        floor: -4,
        zone: 'C-14',
        building: '롯데몰',
        memo: '엘리베이터 근처',
        lat: 37.4979,
        lng: 127.0276,
        accuracy: 8.0,
      );
      final back = ParkingRecord.fromJson(r.toJson());
      expect(back.floor, -4);
      expect(back.zone, 'C-14');
      expect(back.building, '롯데몰');
      expect(back.lat, 37.4979);
      expect(back.ts, r.ts);
    });

    test('층수 표기', () {
      final b2 = ParkingRecord(id: 1, ts: DateTime(2026), floor: -2);
      expect(b2.floorText, 'B2');
      expect(b2.floorKorean, '지하 2층');
      final f3 = ParkingRecord(id: 2, ts: DateTime(2026), floor: 3);
      expect(f3.floorText, '3F');
      expect(f3.isBasement, isFalse);
    });

    test('경과시간 표기', () {
      expect(formatElapsed(const Duration(minutes: 42)), '42분 경과');
      expect(formatElapsed(const Duration(hours: 3, minutes: 24)), '3시간 24분 경과');
      expect(formatElapsed(const Duration(days: 1, hours: 2)), '1일 2시간 경과');
    });
  });
}
