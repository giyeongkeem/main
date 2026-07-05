import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// 사진에서 추출한 주차 위치 표기.
class OcrParkingInfo {
  final int? floor; // 음수 = 지하
  final String? zone;
  const OcrParkingInfo({this.floor, this.zone});

  bool get isEmpty => floor == null && zone == null;
}

/// 기둥 표지판 사진에서 층수/구역을 온디바이스 OCR(ML Kit)로 인식한다.
/// 한국어 스크립트 모델이라 "지하 3층" 같은 한글 표기도 읽는다. 오프라인 동작.
class OcrService {
  OcrService._();

  static Future<OcrParkingInfo> scanImage(String imagePath) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.korean);
    try {
      final result =
          await recognizer.processImage(InputImage.fromFilePath(imagePath));
      return parse(result.text);
    } catch (_) {
      return const OcrParkingInfo();
    } finally {
      await recognizer.close();
    }
  }

  /// 인식된 텍스트에서 층수/구역 표기를 추출한다 (순수 함수, 테스트 대상).
  static OcrParkingInfo parse(String text) {
    final t = text.toUpperCase();
    int? floor;

    // 층수: "지하 3층" > "B3" > "3F" > "지상 3층 / 3층" 순으로 신뢰
    final korBasement = RegExp(r'지하\s*(\d{1,2})\s*층?').firstMatch(t);
    final engBasement =
        RegExp(r'(?:^|[^A-Z0-9])B\s?(\d{1,2})(?![0-9])').firstMatch(t);
    final engGround =
        RegExp(r'(?:^|[^A-Z0-9])(\d{1,2})\s?F(?![A-Z])').firstMatch(t);
    final korGround = RegExp(r'(?:지상\s*)?(\d{1,2})\s*층').firstMatch(t);

    if (korBasement != null) {
      floor = -int.parse(korBasement.group(1)!);
    } else if (engBasement != null) {
      floor = -int.parse(engBasement.group(1)!);
    } else if (engGround != null) {
      floor = int.parse(engGround.group(1)!);
    } else if (korGround != null) {
      floor = int.parse(korGround.group(1)!);
    }
    if (floor != null) {
      if (floor < -10) floor = -10;
      if (floor > 20) floor = 20;
      if (floor == 0) floor = null;
    }

    // 구역: "C-14" 같은 문자-숫자(하이픈 필수) 또는 "가-3" 한글 구역
    String? zone;
    for (final m in RegExp(r'(?:^|[^A-Z0-9가-힣])([A-Z]{1,2}|[가-힣])\s?-\s?(\d{1,3})(?![0-9])')
        .allMatches(t)) {
      final letters = m.group(1)!;
      final digits = m.group(2)!;
      // "B-3"이 이미 층수(B3)로 잡힌 값과 같으면 구역이 아니라 층 표기로 간주
      if (letters == 'B' && floor != null && int.parse(digits) == -floor) {
        continue;
      }
      zone = '$letters-$digits';
      break;
    }

    return OcrParkingInfo(floor: floor, zone: zone);
  }
}
