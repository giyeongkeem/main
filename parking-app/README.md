# 어디주차 🅿️ — iOS / Android 네이티브 앱 (Flutter)

지하 층수까지 기록하는 주차 위치 앱. 하나의 Flutter 코드로 **아이폰과 갤럭시(안드로이드)** 를 모두 지원합니다.
웹앱 버전(`../parking-tracker`)에서 불가능했던 센서 기능이 핵심입니다.

## 웹앱 대비 네이티브만의 기능

| 기능 | 방식 |
|---|---|
| **지하 층수 자동 추정** | **기압계 센서**. 야외(GPS 정확도 양호)에서 지상 기준 기압을 잡고, 지하로 내려가며 오르는 기압으로 몇 층인지 계산(3.2m/층 ≈ 0.38hPa). 추정값은 "적용" 칩으로 제안되고 사용자가 확정 |
| **오프라인 OCR** | Google ML Kit **온디바이스** 문자 인식(한국어 모델). 통신 안 되는 지하에서도 기둥 사진 → "B3 · C-14" 자동 입력 |
| **주차 순간 감지 (Android)** | 차량 블루투스 연결 해제 브로드캐스트 수신 → "방금 주차하셨나요?" 알림 → 탭하면 빠른저장 |
| **주차 순간 감지 (iOS)** | 단축어 자동화 연동: 블루투스/CarPlay 해제 시 `eodijucha://quick` 열기 → 빠른저장 (iOS 정책상 서드파티 앱이 직접 감지는 불가) |
| **위치 자동 감지** | GPS + 기기 내장 역지오코더로 건물 이름 자동 입력 (웹 버전과 동일하지만 더 빠르고 안정적) |

그 외 기능(층수 스테퍼·원터치 선택, 구역/메모, 사진, 경과시간, 공유, 카카오맵 링크, 히스토리)은 웹앱과 동일합니다.

## 프로젝트 구조

```
lib/
├── main.dart                      # 앱 진입점, 테마
├── models/parking_record.dart     # 주차 기록 모델 (floor: 음수=지하)
├── services/
│   ├── storage_service.dart       # SharedPreferences 저장 (기기 안에만 저장)
│   ├── location_service.dart      # GPS + 역지오코딩
│   ├── floor_estimator.dart       # 기압계 → 지하 층수 추정
│   ├── ocr_service.dart           # ML Kit OCR + 층수/구역 파서
│   └── native_bridge.dart         # 안드로이드 알림 → 빠른저장 채널
├── screens/                       # 기록하기 / 내 차 위치 / 히스토리
└── widgets/floor_picker.dart      # B10~20F 층수 선택 위젯

android/…/BtDisconnectReceiver.kt  # 차량 블루투스 해제 → 알림 (안드로이드 전용)
android/…/MainActivity.kt          # 알림 탭 → Flutter 빠른저장 연결
ios/Runner/Info.plist              # 권한 문구 + eodijucha:// URL 스킴
```

## 내 아이폰에 설치하기 (테스트)

`parking-app/`이 변경될 때마다 GitHub Actions가 자동으로 **iOS IPA(무서명)** 와 **Android APK**를 빌드합니다.
[Actions 탭](https://github.com/giyeongkeem/main/actions) → 최신 "어디주차 앱 빌드" 실행 → 하단 **Artifacts**에서 다운로드.

iOS는 애플 정책상 "서명" 없이는 설치가 안 되므로, 아래 세 방법 중 하나로 서명해서 넣습니다:

### 방법 1 — Mac이 있는 경우 (가장 간단, 무료)
IPA 필요 없이 소스에서 바로 실행합니다.
```bash
git clone https://github.com/giyeongkeem/main.git && cd main/parking-app
flutter pub get
open ios/Runner.xcworkspace   # Xcode에서 Signing & Capabilities → 본인 Apple ID 팀 선택
flutter run                   # 아이폰을 USB로 연결한 상태
```
- 무료 Apple ID면 앱이 **7일간 유효** (만료 시 다시 `flutter run`), 유료 개발자 계정($99/년)이면 1년.
- 첫 실행 시 아이폰에서 설정 → 일반 → VPN 및 기기 관리 → 개발자 앱 신뢰.

### 방법 2 — Mac이 없는 경우 (Windows PC + 무료 Apple ID)
1. Actions Artifacts에서 `eodijucha-ios-unsigned-ipa` 다운로드 → 압축 풀면 `eodijucha-unsigned.ipa`
2. PC에 [Sideloadly](https://sideloadly.io/) 설치 (iTunes/iCloud 필요)
3. 아이폰을 USB로 연결 → IPA를 Sideloadly에 드래그 → Apple ID 로그인 → Start
4. 아이폰에서 설정 → 일반 → VPN 및 기기 관리 → 해당 Apple ID **신뢰**

무료 Apple ID는 7일마다 재서명이 필요합니다(Sideloadly 재실행). AltStore를 쓰면 자동 갱신됩니다.

### 방법 3 — TestFlight (유료 Apple Developer 계정, $99/년)
7일 제한 없이 가족·지인에게도 배포할 수 있는 정식 베타 채널입니다.
계정이 있다면 인증서를 GitHub Secrets에 넣어 **CI가 자동으로 TestFlight에 올리도록** 확장할 수 있습니다 (요청 시 세팅해 드림).

### 갤럭시는?
Artifacts에서 `eodijucha-android-apk` 받아서 폰으로 옮겨 열면 바로 설치됩니다 (출처 불명 앱 허용 필요).

## 빌드 & 실행

Flutter SDK 설치([docs.flutter.dev](https://docs.flutter.dev/get-started/install)) 후:

```bash
cd parking-app
flutter pub get

# 갤럭시(안드로이드) — Android Studio 또는 Android SDK 필요
flutter run                # 연결된 기기에서 실행
flutter build apk          # 배포용 APK

# 아이폰 — macOS + Xcode 필요
cd ios && pod install && cd ..
flutter run
flutter build ipa          # App Store 배포용
```

검증 상태: `flutter analyze` 통과(경고 0), 단위 테스트 18개 통과(OCR 파서, 기압→층수 계산, 직렬화).
실기기 빌드는 Android SDK/Xcode가 있는 로컬 환경에서 확인이 필요합니다.

## 자동 감지 설정 방법

### 갤럭시 (자동)
앱을 한 번 실행해 알림·블루투스 권한을 허용하면 끝. 차량 블루투스가 끊길 때마다
"방금 주차하셨나요? 🅿️" 알림이 오고, 탭하면 GPS·건물 이름이 채워진 채 즉시 저장됩니다.

### 아이폰 (단축어 1회 설정)
1. **단축어** 앱 → **자동화** → **+** → **블루투스** (또는 CarPlay)
2. 차량 기기 선택, "연결 해제될 때" + "즉시 실행"
3. 동작: **URL 열기** → `eodijucha://quick`

이후 차에서 내리면 자동으로 앱이 열리며 빠른저장됩니다.

### 지하 층수 추정 정확도에 대해
기압은 날씨에 따라서도 변하므로(시간당 ±0.5hPa 이상 변할 때도 있음) 추정값은 **제안**으로 표시되고,
지상 기준을 잡은 지 오래됐다면 오차가 커질 수 있습니다. 주차 직전 야외에서 앱이 한 번 열려 있었다면
(빠른저장 플로우) 정확도가 가장 좋습니다. 확실한 값은 항상 사진 OCR 또는 원터치 층수 버튼으로 확정하세요.

## 권한

| 권한 | 용도 |
|---|---|
| 위치 (사용 중) | 주차 위치 좌표 + 건물 이름 자동 입력 |
| 카메라 | 기둥 표지판 촬영 → OCR |
| 동작/피트니스 (iOS) | 기압계 접근 (지하 층수 추정) |
| 블루투스 연결 (Android) | 차량 연결 해제 감지 |
| 알림 (Android) | 주차 감지 알림 |

모든 데이터는 기기 안에만 저장되며 어떤 서버로도 전송되지 않습니다.
