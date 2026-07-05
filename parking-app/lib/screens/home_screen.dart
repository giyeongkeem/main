import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';

import '../models/parking_record.dart';
import '../services/floor_estimator.dart';
import '../services/location_service.dart';
import '../services/native_bridge.dart';
import '../services/storage_service.dart';
import 'current_tab.dart';
import 'history_tab.dart';
import 'record_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with WidgetsBindingObserver {
  int _tab = 0;
  ParkingRecord? _current;
  StreamSubscription<Uri>? _linkSub;
  final _historyKey = GlobalKey<HistoryTabState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    FloorEstimator.instance.start();
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    FloorEstimator.instance.stop();
    _linkSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      FloorEstimator.instance.start();
      _checkQuickLaunch(); // 블루투스 해제 알림 탭으로 돌아온 경우
    } else if (state == AppLifecycleState.paused) {
      FloorEstimator.instance.stop();
    }
  }

  Future<void> _init() async {
    final cur = await StorageService.instance.loadCurrent();
    if (mounted) {
      setState(() {
        _current = cur;
        if (cur != null) _tab = 1; // 주차 중이면 "내 차 위치" 먼저
      });
    }

    // 딥링크 eodijucha://quick — iOS 단축어/안드로이드 자동화 연동
    final appLinks = AppLinks();
    try {
      final initial = await appLinks.getInitialLink();
      if (initial != null && _isQuickLink(initial)) {
        unawaited(_quickSave());
      }
    } catch (_) {}
    _linkSub = appLinks.uriLinkStream.listen((uri) {
      if (_isQuickLink(uri)) unawaited(_quickSave());
    });

    await _checkQuickLaunch();
  }

  bool _isQuickLink(Uri uri) =>
      uri.scheme == 'eodijucha' &&
      (uri.host == 'quick' || uri.path.contains('quick'));

  Future<void> _checkQuickLaunch() async {
    if (await NativeBridge.consumeQuickLaunch()) {
      unawaited(_quickSave());
    }
  }

  /// 빠른저장: GPS + 건물 이름을 자동으로 채워 즉시 저장.
  /// 층수는 마지막 사용 값(사용자가 나중에 확인/수정).
  Future<void> _quickSave() async {
    _toast('빠른저장: 위치 확인 중…');
    final pos = await LocationService.getPosition();
    String building = '';
    if (pos != null && pos.accuracy <= 30) {
      FloorEstimator.instance.markOutdoor();
    }
    if (pos != null) {
      final place =
          await LocationService.reverseGeocode(pos.latitude, pos.longitude);
      building = place.name ?? '';
    }

    await StorageService.instance.finishCurrent();
    final lastFloor = await StorageService.instance.loadLastFloor();
    final record = ParkingRecord(
      id: DateTime.now().millisecondsSinceEpoch,
      ts: DateTime.now(),
      floor: lastFloor,
      building: building,
      memo: '빠른저장 — 층수를 확인해 주세요',
      lat: pos?.latitude,
      lng: pos?.longitude,
      accuracy: pos?.accuracy,
    );
    await StorageService.instance.saveCurrent(record);

    if (!mounted) return;
    setState(() {
      _current = record;
      _tab = 1;
    });
    _toast('빠른저장 완료 🅿️ 층수를 확인해 주세요');
  }

  Future<void> _reloadCurrent({int? goTab}) async {
    final cur = await StorageService.instance.loadCurrent();
    if (!mounted) return;
    setState(() {
      _current = cur;
      if (goTab != null) _tab = goTab;
    });
    _historyKey.currentState?.reload();
  }

  Future<void> _finishParking() async {
    await StorageService.instance.finishCurrent();
    await _reloadCurrent();
    _toast('주차 기록을 종료했어요');
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      RecordTab(onSaved: () => _reloadCurrent(goTab: 1)),
      CurrentTab(
        record: _current,
        onFinish: _finishParking,
        onGoRecord: () => setState(() => _tab = 0),
      ),
      HistoryTab(key: _historyKey),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('🅿️ ', style: TextStyle(fontSize: 20)),
            Text('어디주차',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
          ],
        ),
        centerTitle: false,
      ),
      body: IndexedStack(index: _tab, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) {
          setState(() => _tab = i);
          if (i == 2) _historyKey.currentState?.reload();
        },
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.add_location_alt_outlined),
              selectedIcon: Icon(Icons.add_location_alt),
              label: '기록하기'),
          NavigationDestination(
              icon: Icon(Icons.directions_car_outlined),
              selectedIcon: Icon(Icons.directions_car),
              label: '내 차 위치'),
          NavigationDestination(
              icon: Icon(Icons.history_outlined),
              selectedIcon: Icon(Icons.history),
              label: '기록'),
        ],
      ),
    );
  }
}
