// HealthKitManager.swift
// 안부 — 부모님 폰(또는 워치 페어링된 폰)에서 돌아가는 데이터 수집 계층.
//
// 설계 메모:
// - HealthKit은 서버로 데이터를 "실시간 스트리밍"하지 않는다. 워치 → 폰 동기화는
//   수 분~수 시간 지연될 수 있고, 야간 데이터는 아침에야 도착하기도 한다.
//   서버의 무수신(no_data) 규칙이 48시간으로 느슨한 이유가 이것이다.
// - 부모님은 앱을 열지 않는다는 전제 → HKObserverQuery + 백그라운드 전달로
//   폰이 알아서 업로드하게 만드는 것이 이 파일의 전부다.
// - 필요한 권한(읽기): 걸음 수, 심박수, 수면 분석. Info.plist에
//   NSHealthShareUsageDescription, Signing & Capabilities에 HealthKit +
//   Background Delivery를 켜야 한다.

import Foundation
import HealthKit

final class HealthKitManager {
    static let shared = HealthKitManager()
    private let store = HKHealthStore()
    private let uploader = SampleUploader()

    private let readTypes: Set<HKObjectType> = [
        HKQuantityType(.stepCount),
        HKQuantityType(.heartRate),
        HKCategoryType(.sleepAnalysis),
    ]

    // MARK: - 온보딩에서 1회 호출 (자녀가 부모님 폰을 설정해 주는 시나리오)
    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw AnbuError.healthKitUnavailable
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    // MARK: - 백그라운드 전달 등록 — 앱이 죽어 있어도 새 샘플이 오면 깨워 준다
    func enableBackgroundDelivery() {
        for type in readTypes.compactMap({ $0 as? HKSampleType }) {
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { ok, error in
                if let error { AnbuLog.error("background delivery 실패: \(error)") }
                else if ok { AnbuLog.info("background delivery 등록: \(type.identifier)") }
            }
            registerObserver(for: type)
        }
    }

    private func registerObserver(for type: HKSampleType) {
        // completionHandler를 반드시 불러야 다음 알림이 온다 — 잊으면 전달이 멈춘다.
        let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, done, error in
            defer { done() }
            if let error { AnbuLog.error("observer 오류: \(error)"); return }
            Task { await self?.syncNewSamples(of: type) }
        }
        store.execute(query)
    }

    // MARK: - 앵커드 쿼리로 "지난번 이후 새 샘플"만 증분 수집
    private func syncNewSamples(of type: HKSampleType) async {
        let anchor = AnchorStore.load(for: type.identifier)
        let (samples, newAnchor) = await withCheckedContinuation { cont in
            let q = HKAnchoredObjectQuery(type: type, predicate: nil, anchor: anchor,
                                          limit: HKObjectQueryNoLimit) { _, added, _, anchor, _ in
                cont.resume(returning: (added ?? [], anchor))
            }
            store.execute(q)
        }
        guard !samples.isEmpty else { return }

        let payload = samples.compactMap(Self.toAnbuSample)
        do {
            try await uploader.upload(payload)
            AnchorStore.save(newAnchor, for: type.identifier)  // 업로드 성공 후에만 앵커 전진
        } catch {
            AnbuLog.error("업로드 실패, 다음 깨어날 때 재시도: \(error)")
        }
    }

    // MARK: - HealthKit 샘플 → 서버 인제스트 포맷 변환
    static func toAnbuSample(_ sample: HKSample) -> AnbuSample? {
        switch sample {
        case let s as HKQuantitySample where s.quantityType == HKQuantityType(.stepCount):
            // 걸음은 서버에서 일 단위로 합산하므로 원시 구간값을 그대로 보낸다
            return AnbuSample(type: .stepsRaw, ts: s.startDate,
                              value: s.quantity.doubleValue(for: .count()))
        case let s as HKQuantitySample where s.quantityType == HKQuantityType(.heartRate):
            return AnbuSample(type: .heartRate, ts: s.startDate,
                              value: s.quantity.doubleValue(for: .init(from: "count/min")))
        case let s as HKCategorySample where s.categoryType == HKCategoryType(.sleepAnalysis):
            return AnbuSample(type: .sleepStage, ts: s.startDate,
                              value: Double(s.value), endTs: s.endDate)
        default:
            return nil
        }
    }
}

enum AnbuError: Error { case healthKitUnavailable }
