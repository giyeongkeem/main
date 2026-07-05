// SampleUploader.swift
// 수집된 샘플을 안부 서버로 배치 업로드. 실패 시 로컬 큐에 쌓아 두었다가
// 다음 백그라운드 웨이크업에서 재시도한다 (부모님 집 와이파이는 자주 끊긴다).

import Foundation
import HealthKit

struct AnbuSample: Codable {
    enum Kind: String, Codable {
        case stepsRaw = "steps_raw"     // 서버에서 일 단위 합산 → steps_day
        case heartRate = "heart_rate"   // 서버에서 야간 구간 평균 → night_hr
        case sleepStage = "sleep_stage" // 기상 시각 추출 → wake_time
        case motion = "motion"          // CoreMotion 기반 마지막 움직임
    }
    let type: Kind
    let ts: Date
    var value: Double? = nil
    var endTs: Date? = nil
}

actor SampleUploader {
    private let session = URLSession(configuration: .default)
    private var pending: [AnbuSample] = PendingQueue.load()

    func upload(_ samples: [AnbuSample]) async throws {
        pending.append(contentsOf: samples)

        var request = URLRequest(url: AnbuConfig.ingestURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(AnbuConfig.deviceToken)", forHTTPHeaderField: "Authorization")

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        request.httpBody = try encoder.encode(["samples": pending])

        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            PendingQueue.save(pending)   // 실패 → 디스크에 보존, 다음 웨이크업에 재시도
            throw URLError(.badServerResponse)
        }
        pending.removeAll()
        PendingQueue.save(pending)
    }
}

/// 업로드 실패분의 디스크 보존 큐 — UserDefaults가 아니라 파일로 (수 KB~수 MB 가능)
enum PendingQueue {
    private static var url: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("anbu-pending.json")
    }
    static func load() -> [AnbuSample] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601
        return (try? d.decode([AnbuSample].self, from: data)) ?? []
    }
    static func save(_ q: [AnbuSample]) {
        let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601
        try? (try? e.encode(q))?.write(to: url, options: .atomic)
    }
}

enum AnbuConfig {
    // 실서비스에서는 온보딩 시 발급받은 대상자별 토큰과 서버 URL을 키체인에 보관
    static var ingestURL: URL { URL(string: "https://api.anbu.example/v1/seniors/me/ingest")! }
    static var deviceToken: String { "REPLACE_AT_ONBOARDING" }
}

enum AnbuLog {
    static func info(_ m: String) { print("[anbu] \(m)") }
    static func error(_ m: String) { print("[anbu][err] \(m)") }
}

/// 앵커드 쿼리의 증분 위치 저장 — 타입별로 마지막으로 읽은 지점을 기억
enum AnchorStore {
    static func load(for id: String) -> HKQueryAnchor? {
        guard let data = UserDefaults.standard.data(forKey: "anchor.\(id)") else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }
    static func save(_ anchor: HKQueryAnchor?, for id: String) {
        guard let anchor,
              let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true)
        else { return }
        UserDefaults.standard.set(data, forKey: "anchor.\(id)")
    }
}
