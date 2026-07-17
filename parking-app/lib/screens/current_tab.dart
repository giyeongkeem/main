import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/parking_record.dart';

/// "내 차 위치" 화면 — 현재 주차 카드.
class CurrentTab extends StatefulWidget {
  final ParkingRecord? record;
  final VoidCallback onFinish;
  final VoidCallback onGoRecord;

  const CurrentTab({
    super.key,
    required this.record,
    required this.onFinish,
    required this.onGoRecord,
  });

  @override
  State<CurrentTab> createState() => _CurrentTabState();
}

class _CurrentTabState extends State<CurrentTab> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // 경과시간 갱신
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _share(ParkingRecord r) async {
    final buf = StringBuffer('[내 주차 위치] ${r.floorText} (${r.floorKorean})');
    if (r.placeLine.isNotEmpty) buf.write(' — ${r.placeLine}');
    if (r.memo.isNotEmpty) buf.write('\n메모: ${r.memo}');
    buf.write('\n주차 시각: ${formatDateTime(r.ts)}');
    if (r.hasGps) {
      buf.write('\n지도: https://map.kakao.com/link/map/주차위치,${r.lat},${r.lng}');
    }
    await Share.share(buf.toString());
  }

  Future<void> _openMap(ParkingRecord r) async {
    final uri =
        Uri.parse('https://map.kakao.com/link/map/내주차위치,${r.lat},${r.lng}');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.record;
    final scheme = Theme.of(context).colorScheme;

    if (r == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🚗', style: TextStyle(fontSize: 44)),
              const SizedBox(height: 12),
              Text(
                '아직 기록된 주차 위치가 없어요.',
                textAlign: TextAlign.center,
                style: TextStyle(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 16),
              FilledButton.tonal(
                onPressed: widget.onGoRecord,
                child: const Text('주차 위치 기록하러 가기'),
              ),
            ],
          ),
        ),
      );
    }

    final elapsed = DateTime.now().difference(r.ts);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF1A73E8), Color(0xFF5B3DF5)],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('내 차는 여기에 있어요',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white.withValues(alpha: 0.75))),
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(r.floorText,
                      style: const TextStyle(
                          fontSize: 46,
                          fontWeight: FontWeight.w900,
                          color: Colors.white)),
                  const SizedBox(width: 8),
                  Text(r.floorKorean,
                      style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Colors.white.withValues(alpha: 0.85))),
                ],
              ),
              if (r.placeLine.isNotEmpty)
                Text(r.placeLine,
                    style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
              const SizedBox(height: 8),
              if (r.memo.isNotEmpty)
                Text('📝 ${r.memo}',
                    style: TextStyle(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.85))),
              Text('🕐 ${formatDateTime(r.ts)} 주차',
                  style: TextStyle(
                      fontSize: 13,
                      color: Colors.white.withValues(alpha: 0.8))),
              const SizedBox(height: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(formatElapsed(elapsed),
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white)),
              ),
              if (r.photoPath != null && File(r.photoPath!).existsSync()) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  // cacheWidth: 화면 폭 수준으로만 디코딩해 메모리·스크롤 성능 확보
                  child: Image.file(File(r.photoPath!),
                      fit: BoxFit.cover, cacheWidth: 1080),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _HeroButton(
                        label: '📤 공유', onTap: () => _share(r)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _HeroButton(
                      label: r.hasGps ? '🗺️ 지도 보기' : '🗺️ GPS 없음',
                      onTap: r.hasGps ? () => _openMap(r) : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: widget.onFinish,
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF1A73E8),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    textStyle: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  child: const Text('✅ 차 찾았어요 (주차 종료)'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  const _HeroButton({required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: onTap == null ? 0.08 : 0.16),
      borderRadius: BorderRadius.circular(11),
      child: InkWell(
        borderRadius: BorderRadius.circular(11),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Colors.white.withValues(alpha: onTap == null ? 0.5 : 1),
            ),
          ),
        ),
      ),
    );
  }
}
