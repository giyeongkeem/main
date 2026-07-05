# 안부 iOS 스켈레톤 (AnbuKit)

부모님 폰에서 돌아가는 **무조작 데이터 수집 계층**의 핵심 코드입니다.
Xcode 프로젝트 파일은 포함하지 않았습니다 — 새 iOS App 타깃에 이 두 파일을 넣고
아래 체크리스트를 적용하면 동작하는 뼈대가 됩니다.

## 파일

| 파일 | 역할 |
|---|---|
| `AnbuKit/HealthKitManager.swift` | 권한 요청, 백그라운드 전달(HKObserverQuery), 앵커드 증분 수집 |
| `AnbuKit/SampleUploader.swift` | 배치 업로드 + 실패분 디스크 큐 재시도, 앵커 저장 |

## Xcode 설정 체크리스트

1. **Signing & Capabilities** → `HealthKit` 추가, `Background Modes`에서
   `Background fetch` + `Background processing` 체크
2. **Info.plist** → `NSHealthShareUsageDescription`
   ("가족에게 안부 신호를 전달하기 위해 걸음·심박·수면 데이터를 읽습니다")
3. 앱 시작 시:
   ```swift
   try await HealthKitManager.shared.requestAuthorization()
   HealthKitManager.shared.enableBackgroundDelivery()
   ```
4. 온보딩(자녀가 설정)에서 서버 발급 디바이스 토큰을 키체인에 저장하고
   `AnbuConfig`를 교체

## 설계상 주의점 (서버 규칙과의 계약)

- **HealthKit은 실시간이 아니다.** 워치→폰 동기화는 시간 단위로 지연될 수 있다.
  서버의 무수신 판정이 48시간인 것은 이 지연을 흡수하기 위함이다.
- **HKObserverQuery의 completionHandler는 반드시 호출** — 안 부르면 iOS가
  백그라운드 전달을 중단한다.
- **앵커는 업로드 성공 후에만 전진** — 실패 시 같은 구간을 다시 읽어 유실을 막는다.
- 낙상 감지는 워치의 `CMFallDetectionManager`(watchOS 컴패니언 필요) 영역으로,
  이 스켈레톤 범위 밖. 2단계에서 watchOS 익스텐션으로 추가한다.
