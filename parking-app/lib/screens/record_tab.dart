import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';

import '../models/parking_record.dart';
import '../services/floor_estimator.dart';
import '../services/location_service.dart';
import '../services/ocr_service.dart';
import '../services/storage_service.dart';
import '../widgets/floor_picker.dart';

/// 주차 위치 기록 화면.
/// 진입 시 GPS·건물 이름을 자동 감지하고, 기압계로 지하 층수를 추정해 제안한다.
class RecordTab extends StatefulWidget {
  final VoidCallback onSaved;

  const RecordTab({super.key, required this.onSaved});

  @override
  State<RecordTab> createState() => _RecordTabState();
}

class _RecordTabState extends State<RecordTab>
    with AutomaticKeepAliveClientMixin {
  final _zoneCtrl = TextEditingController();
  final _buildingCtrl = TextEditingController();
  final _memoCtrl = TextEditingController();

  int _floor = -2;
  String? _photoPath;
  double? _lat, _lng, _accuracy;
  String _autoLocStatus = '📍 현재 위치 자동 감지 중…';
  bool _autoLocDone = false;
  bool _ocrRunning = false;
  bool _saving = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadLastFloor();
    _autoDetectLocation();
  }

  @override
  void dispose() {
    _zoneCtrl.dispose();
    _buildingCtrl.dispose();
    _memoCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadLastFloor() async {
    final f = await StorageService.instance.loadLastFloor();
    if (mounted) setState(() => _floor = f);
  }

  Future<void> _autoDetectLocation() async {
    final pos = await LocationService.getPosition();
    if (!mounted) return;
    if (pos == null) {
      setState(() => _autoLocStatus = '위치 권한이 없어 자동 감지를 건너뛰었어요');
      return;
    }
    setState(() {
      _lat = pos.latitude;
      _lng = pos.longitude;
      _accuracy = pos.accuracy;
      _autoLocStatus =
          '📍 GPS 저장됨 (±${pos.accuracy.round()}m) · 주소 확인 중…';
    });

    // 야외로 보이면(정확도 양호) 기압 지상 기준 갱신 → 지하 층수 추정에 사용
    if (pos.accuracy <= 30) {
      FloorEstimator.instance.markOutdoor();
    }

    final place = await LocationService.reverseGeocode(pos.latitude, pos.longitude);
    if (!mounted) return;
    setState(() {
      if (place.name != null && _buildingCtrl.text.trim().isEmpty) {
        _buildingCtrl.text = place.name!;
      }
      final label = [place.name, place.address].whereType<String>().join(' · ');
      _autoLocStatus = '✅ ${label.isEmpty ? '위치 감지됨' : label}';
      _autoLocDone = true;
    });
  }

  Future<void> _takePhoto() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.camera,
      maxWidth: 1600,
      imageQuality: 82,
    );
    if (picked == null || !mounted) return;

    // 앱 문서 폴더로 복사(임시 파일은 OS가 지울 수 있음)
    final dir = await getApplicationDocumentsDirectory();
    final dest =
        '${dir.path}/parking_${DateTime.now().millisecondsSinceEpoch}.jpg';
    await File(picked.path).copy(dest);
    if (!mounted) return;
    setState(() {
      _photoPath = dest;
      _ocrRunning = true;
    });

    // 온디바이스 OCR로 층수/구역 자동 인식 (오프라인 동작)
    final info = await OcrService.scanImage(dest);
    if (!mounted) return;
    setState(() {
      _ocrRunning = false;
      final applied = <String>[];
      if (info.floor != null) {
        _floor = info.floor!;
        applied.add(FloorPicker.floorText(_floor));
      }
      if (info.zone != null && _zoneCtrl.text.trim().isEmpty) {
        _zoneCtrl.text = info.zone!;
        applied.add(info.zone!);
      }
      if (applied.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('사진에서 자동 인식: ${applied.join(' · ')} ✨')),
        );
      }
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);

    await StorageService.instance.finishCurrent(); // 기존 주차 → 히스토리
    final record = ParkingRecord(
      id: DateTime.now().millisecondsSinceEpoch,
      ts: DateTime.now(),
      floor: _floor,
      zone: _zoneCtrl.text.trim(),
      building: _buildingCtrl.text.trim(),
      memo: _memoCtrl.text.trim(),
      photoPath: _photoPath,
      lat: _lat,
      lng: _lng,
      accuracy: _accuracy,
    );
    await StorageService.instance.saveCurrent(record);
    await StorageService.instance.saveLastFloor(_floor);

    if (!mounted) return;
    setState(() {
      _zoneCtrl.clear();
      _memoCtrl.clear();
      _photoPath = null;
      _saving = false;
    });
    widget.onSaved();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final scheme = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _Card(
          title: '층수 (지하는 B로 표시)',
          child: Column(
            children: [
              FloorPicker(
                floor: _floor,
                onChanged: (f) => setState(() => _floor = f),
              ),
              _BarometerSuggestion(
                currentFloor: _floor,
                onApply: (f) => setState(() => _floor = f),
              ),
            ],
          ),
        ),
        _Card(
          title: '위치 상세',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: _autoLocDone
                      ? scheme.primaryContainer.withValues(alpha: 0.5)
                      : scheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(_autoLocStatus,
                    style: TextStyle(
                        fontSize: 12.5, color: scheme.onSurfaceVariant)),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _zoneCtrl,
                      decoration: const InputDecoration(
                        labelText: '구역 / 기둥 번호',
                        hintText: '예: C-14',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _buildingCtrl,
                      decoration: const InputDecoration(
                        labelText: '건물 / 주차장',
                        hintText: '자동 감지됨',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _memoCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: '메모',
                  hintText: '예: 엘리베이터 B 근처, 파란 기둥 옆',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        _Card(
          title: '기둥 표지판 사진 → 층수·구역 자동 인식',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                onPressed: _ocrRunning ? null : _takePhoto,
                icon: _ocrRunning
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.photo_camera_outlined),
                label: Text(_ocrRunning
                    ? '사진에서 위치 인식 중…'
                    : (_photoPath == null ? '사진 찍기' : '사진 다시 찍기')),
                style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13)),
              ),
              if (_photoPath != null) ...[
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: Image.file(File(_photoPath!), fit: BoxFit.cover),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 4),
        FilledButton(
          onPressed: _saving ? null : _save,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 17),
            textStyle:
                const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          child: Text(_saving ? '저장 중…' : '🅿️ 주차 위치 저장'),
        ),
      ],
    );
  }
}

/// 기압계 추정 층이 현재 선택과 다르면 "적용" 칩을 보여준다.
class _BarometerSuggestion extends StatelessWidget {
  final int currentFloor;
  final ValueChanged<int> onApply;

  const _BarometerSuggestion(
      {required this.currentFloor, required this.onApply});

  @override
  Widget build(BuildContext context) {
    final est = FloorEstimator.instance;
    return ValueListenableBuilder<bool>(
      valueListenable: est.available,
      builder: (context, available, _) {
        if (!available) return const SizedBox.shrink();
        return ValueListenableBuilder<int?>(
          valueListenable: est.suggestedFloor,
          builder: (context, suggested, _) {
            if (suggested == null) {
              return Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  '기압계 감지됨 — 야외에서 GPS가 잡히면 지하 층수를 자동 추정해요',
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              );
            }
            if (suggested == currentFloor) {
              return Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  '기압 추정 층수와 일치: ${FloorPicker.floorText(suggested)} ✓',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.primary),
                ),
              );
            }
            return Padding(
              padding: const EdgeInsets.only(top: 10),
              child: ActionChip(
                avatar: const Icon(Icons.speed, size: 17),
                label: Text(
                    '기압 추정: ${FloorPicker.floorText(suggested)} (${FloorPicker.floorKorean(suggested)}) — 적용'),
                onPressed: () => onApply(suggested),
              ),
            );
          },
        );
      },
    );
  }
}

class _Card extends StatelessWidget {
  final String title;
  final Widget child;

  const _Card({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title,
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurfaceVariant)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
