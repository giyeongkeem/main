// CheckInController.swift (watchOS)
// "AI 안부전화"의 워치 쪽 절반 — 서버가 주의 신호를 감지해 안부 확인을 요청하면
// 워치가 진동하며 초대형 버튼 두 개를 띄운다. 어르신의 조작은 탭 한 번이 전부다.
//
//   ┌──────────────────────┐
//   │   괜찮으신가요?        │
//   │                      │
//   │  [ 😊 괜찮아요 ]      │  → 알림 resolve, 상황 종료
//   │  [ 📞 도움 필요 ]      │  → 즉시 복지사/보호자 단계로 escalate
//   └──────────────────────┘
//
// 90초 무응답이면 서버가 자동으로 다음 단계(복지사 확인)로 상향한다 —
// 워치가 아니라 서버가 타이머를 갖는 것이 핵심이다 (워치 배터리가 죽어도 동작).

import SwiftUI
import UserNotifications
import WatchKit

@MainActor
final class CheckInController: ObservableObject {
    static let shared = CheckInController()

    @Published var activeAlertID: Int?
    @Published var isFallCheckIn = false

    /// 서버 푸시(APNs) 페이로드: {"alert_id": 123, "kind": "steps_drop"}
    func handleCheckInPush(alertID: Int) {
        activeAlertID = alertID
        isFallCheckIn = false
        // 주의를 끄는 순서: 햅틱 2회 → 화면 켜짐 → 풀스크린 확인 뷰
        WKInterfaceDevice.current().play(.notification)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            WKInterfaceDevice.current().play(.notification)
        }
    }

    func presentFallCheckIn() {
        activeAlertID = nil     // 낙상은 아직 서버 알림 ID가 없을 수 있다
        isFallCheckIn = true
    }

    func respondOK() async {
        if let id = activeAlertID {
            await postAction(alertID: id, action: "resolve")
        }
        WKInterfaceDevice.current().play(.success)
        activeAlertID = nil; isFallCheckIn = false
    }

    func respondNeedHelp() async {
        if let id = activeAlertID {
            await postAction(alertID: id, action: "escalate")
        }
        WKInterfaceDevice.current().play(.failure)
        activeAlertID = nil; isFallCheckIn = false
    }

    private func postAction(alertID: Int, action: String) async {
        var request = URLRequest(url: AnbuConfig.alertActionURL(alertID))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(AnbuConfig.deviceToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["action": action])
        _ = try? await URLSession.shared.data(for: request)
    }
}

/// 확인 화면 — 글자 크기·대비·터치 영역 모두 고령 사용자 기준.
struct CheckInView: View {
    @ObservedObject var controller = CheckInController.shared

    var body: some View {
        VStack(spacing: 10) {
            Text(controller.isFallCheckIn ? "넘어지셨나요?" : "괜찮으신가요?")
                .font(.title3.bold())
                .minimumScaleFactor(0.8)

            Button {
                Task { await controller.respondOK() }
            } label: {
                Label("괜찮아요", systemImage: "face.smiling")
                    .font(.title3.bold())
                    .frame(maxWidth: .infinity, minHeight: 52)
            }
            .tint(.green)

            Button {
                Task { await controller.respondNeedHelp() }
            } label: {
                Label("도움 필요", systemImage: "phone.fill")
                    .font(.title3.bold())
                    .frame(maxWidth: .infinity, minHeight: 52)
            }
            .tint(.red)
        }
        .padding(.horizontal, 6)
    }
}

extension AnbuConfig {
    static var fallReportURL: URL { URL(string: "https://api.anbu.example/v1/seniors/me/fall")! }
    static func alertActionURL(_ id: Int) -> URL {
        URL(string: "https://api.anbu.example/v1/alerts/\(id)/action")!
    }
}
