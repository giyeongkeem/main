// FallDetector.swift (watchOS)
// 낙상 감지 — CMFallDetectionManager는 워치가 하드웨어 수준에서 판정한
// 낙상 이벤트를 전달해 준다. 우리가 할 일은 (1) 즉시 서버에 긴급 알림을 만들고
// (2) 어르신에게 "괜찮으세요?" 확인 UI를 띄우는 것 두 가지다.
//
// 요구 사항:
// - watchOS 컴패니언 앱 타깃 + 'Fall Detection' entitlement
//   (com.apple.developer.coremotion.falldetection — Apple 심사 필요)
// - Info.plist: NSFallDetectionUsageDescription
// - 사용자가 워치 설정에서 손목 감지를 켜 두어야 한다

import CoreMotion
import WatchKit

final class FallDetector: NSObject, CMFallDetectionDelegate {
    static let shared = FallDetector()
    private let manager = CMFallDetectionManager()

    func start() {
        guard CMFallDetectionManager.authorizationStatus() != .denied else {
            AnbuLog.error("낙상 감지 권한 거부됨 — 온보딩에서 재안내 필요")
            return
        }
        manager.delegate = self
        manager.requestAuthorization { status in
            AnbuLog.info("낙상 감지 권한: \(status.rawValue)")
        }
    }

    // MARK: - CMFallDetectionDelegate

    func fallDetectionManager(_ manager: CMFallDetectionManager,
                              didDetect event: CMFallDetectionEvent) async {
        // 워치 판정 결과와 무관하게 서버에 먼저 기록한다 — 골든타임에는
        // 오탐 정리보다 신호 유실이 훨씬 비싸다. resolution에 따라 심각도만 나눈다.
        let confirmed: Bool
        switch event.resolution {
        case .confirmed, .unresponsive:  // 사용자가 '넘어졌어요' 또는 무응답
            confirmed = true
        case .dismissed, .rejected:      // '괜찮아요' 응답 또는 오탐 판정
            confirmed = false
        @unknown default:
            confirmed = true
        }

        await AlertReporter.reportFall(at: event.date, confirmed: confirmed)

        if confirmed {
            // 확인 UI + 강한 햅틱 — CheckInController가 응답을 수집한다
            WKInterfaceDevice.current().play(.notification)
            await CheckInController.shared.presentFallCheckIn()
        }
    }

    func fallDetectionManagerDidChangeAuthorization(_ manager: CMFallDetectionManager) {
        AnbuLog.info("낙상 감지 권한 변경: \(CMFallDetectionManager.authorizationStatus().rawValue)")
    }
}

enum AlertReporter {
    /// 낙상 이벤트를 인제스트가 아닌 전용 긴급 채널로 보고한다.
    /// 서버에서는 no_motion과 별개의 'fall' 신호(긴급)로 알림을 만든다.
    static func reportFall(at date: Date, confirmed: Bool) async {
        var request = URLRequest(url: AnbuConfig.fallReportURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(AnbuConfig.deviceToken)", forHTTPHeaderField: "Authorization")
        let body: [String: Any] = ["ts": ISO8601DateFormatter().string(from: date),
                                   "confirmed": confirmed]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            _ = try await URLSession.shared.data(for: request)
        } catch {
            // 네트워크 실패 시에도 워치 자체의 SOS(112/119) 플로우는 OS가 담당한다.
            AnbuLog.error("낙상 보고 실패(재시도 큐 적재): \(error)")
        }
    }
}
